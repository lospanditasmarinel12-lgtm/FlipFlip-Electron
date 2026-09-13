// FlipFlip Audio Helper — creates a "Multi-Output Device" (speakers + BlackHole)
// so system audio is simultaneously audible and captured for haptic feedback.
// Runs as a user process; no admin required for aggregate creation.
// Commands: list | create | status | set-default <uid>
import Foundation
import CoreAudio
import AudioToolbox
import Darwin

let AGGREGATE_UID = "com.flipflip.app.multi-output"
let AGGREGATE_NAME = "FlipFlip Multi-Output"

func fail(_ msg: String) -> Never {
  FileHandle.standardError.write(("ERR " + msg + "\n").data(using: .utf8)!)
  exit(1)
}

func printJson(_ obj: Any) {
  guard JSONSerialization.isValidJSONObject(obj) else { fail("invalid json result") }
  do {
    let data = try JSONSerialization.data(withJSONObject: obj, options: [.prettyPrinted])
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write("\n".data(using: .utf8)!)
  } catch {
    fail("json: \(error)")
  }
}

func getData(_ obj: AudioObjectID, _ selector: AudioObjectPropertySelector,
             _ scope: AudioObjectPropertyScope, _ element: AudioObjectPropertyElement) -> (UnsafeMutableRawPointer, UInt32)? {
  var addr = AudioObjectPropertyAddress(mSelector: selector, mScope: scope, mElement: element)
  var size: UInt32 = 0
  guard AudioObjectGetPropertyDataSize(obj, &addr, 0, nil, &size) == noErr, size > 0 else { return nil }
  let buf = UnsafeMutableRawPointer.allocate(byteCount: Int(size), alignment: MemoryLayout<UInt8>.alignment)
  var got = size
  guard AudioObjectGetPropertyData(obj, &addr, 0, nil, &got, buf) == noErr else {
    buf.deallocate()
    return nil
  }
  return (buf, got)
}

func cfString(_ obj: AudioObjectID, _ selector: AudioObjectPropertySelector) -> String? {
  var addr = AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
  var size: UInt32 = 0
  guard AudioObjectGetPropertyDataSize(obj, &addr, 0, nil, &size) == noErr, size > 0 else { return nil }
  var cf: CFString?
  let st = withUnsafeMutablePointer(to: &cf) { p in
    AudioObjectGetPropertyData(obj, &addr, 0, nil, &size, UnsafeMutableRawPointer(p))
  }
  guard st == noErr, let c = cf else { return nil }
  return c as String
}

func deviceIDs() -> [AudioObjectID] {
  guard let d = getData(AudioObjectID(kAudioObjectSystemObject), kAudioHardwarePropertyDevices,
                        kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain) else { return [] }
  defer { d.0.deallocate() }
  let count = Int(d.1) / MemoryLayout<AudioObjectID>.size
  guard count > 0 else { return [] }
  let ptr = d.0.bindMemory(to: AudioObjectID.self, capacity: count)
  return Array(UnsafeMutableBufferPointer(start: ptr, count: count))
}

func hasOutput(_ id: AudioObjectID) -> Bool {
  var addr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyStreams,
                                        mScope: kAudioObjectPropertyScopeOutput,
                                        mElement: kAudioObjectPropertyElementMain)
  var size: UInt32 = 0
  AudioObjectGetPropertyDataSize(id, &addr, 0, nil, &size)
  return size >= 4
}

func defaultOutputID() -> AudioObjectID {
  guard let d = getData(AudioObjectID(kAudioObjectSystemObject), kAudioHardwarePropertyDefaultOutputDevice,
                        kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain) else { return kAudioObjectUnknown }
  defer { d.0.deallocate() }
  return d.0.load(as: AudioObjectID.self)
}

func findDevice(uid: String) -> AudioObjectID? {
  return deviceIDs().first { (cfString($0, kAudioDevicePropertyDeviceUID) ?? "") == uid }
}

func exists() -> Bool { findDevice(uid: AGGREGATE_UID) != nil }

func blackholeDriverInstalled() -> Bool {
  let dir = "/Library/Audio/Plug-Ins/HAL"
  guard FileManager.default.fileExists(atPath: dir) else { return false }
  let files = (try? FileManager.default.contentsOfDirectory(atPath: dir)) ?? []
  return files.contains { $0.lowercased().hasPrefix("blackhole") && $0.hasSuffix(".driver") }
}

func blackholeDevice() -> AudioObjectID? {
  let ids = deviceIDs()
  if let two = ids.first(where: { (cfString($0, kAudioObjectPropertyName) ?? "").lowercased().contains("blackhole 2ch") }) {
    return two
  }
  return ids.first { (cfString($0, kAudioObjectPropertyName) ?? "").lowercased().contains("blackhole") }
}

func handleList() {
  var out: [[String: Any]] = []
  for id in deviceIDs() {
    let name = cfString(id, kAudioObjectPropertyName) ?? ""
    let uid = cfString(id, kAudioDevicePropertyDeviceUID) ?? ""
    out.append(["uid": uid, "name": name, "output": hasOutput(id)])
  }
  out.sort { ($0["name"] as? String ?? "").lowercased() < ($1["name"] as? String ?? "").lowercased() }
  printJson(out)
}

func setRate(_ id: AudioObjectID, _ hz: Float64) {
  var addr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyNominalSampleRate,
                                        mScope: kAudioObjectPropertyScopeGlobal,
                                        mElement: kAudioObjectPropertyElementMain)
  var r = hz
  AudioObjectSetPropertyData(id, &addr, 0, nil, UInt32(MemoryLayout<Float64>.size), &r)
}

func setVolumeScalarScope(_ id: AudioObjectID, _ v: Float32, _ scope: AudioObjectPropertyScope) {
  var addr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyVolumeScalar,
                                        mScope: scope,
                                        mElement: kAudioObjectPropertyElementMain)
  var val = v
  AudioObjectSetPropertyData(id, &addr, 0, nil, UInt32(MemoryLayout<Float32>.size), &val)
  for el: AudioObjectPropertyElement in [1, 2] {
    var a2 = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyVolumeScalar, mScope: scope, mElement: el)
    var vv = v
    AudioObjectSetPropertyData(id, &a2, 0, nil, UInt32(MemoryLayout<Float32>.size), &vv)
  }
}

func setVolumeScalar(_ id: AudioObjectID, _ v: Float32) {
  setVolumeScalarScope(id, v, kAudioObjectPropertyScopeOutput)
}

func volumeScalar(_ id: AudioObjectID, _ scope: AudioObjectPropertyScope) -> Float32 {
  var addr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyVolumeScalar,
                                        mScope: scope,
                                        mElement: kAudioObjectPropertyElementMain)
  var v: Float32 = -1
  var sz = UInt32(MemoryLayout<Float32>.size)
  guard AudioObjectGetPropertyData(id, &addr, 0, nil, &sz, &v) == noErr else { return -1 }
  return v
}

func availableRates(_ id: AudioObjectID) -> [Float64] {
  var addr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyAvailableNominalSampleRates,
                                        mScope: kAudioObjectPropertyScopeGlobal,
                                        mElement: kAudioObjectPropertyElementMain)
  var size: UInt32 = 0
  guard AudioObjectGetPropertyDataSize(id, &addr, 0, nil, &size) == noErr, size > 0 else { return [] }
  let count = Int(size) / MemoryLayout<AudioValueRange>.size
  var ranges = [AudioValueRange](repeating: AudioValueRange(), count: count)
  guard AudioObjectGetPropertyData(id, &addr, 0, nil, &size, &ranges) == noErr else { return [] }
  var out: [Float64] = []
  for r in ranges {
    let lo = r.mMinimum
    if !out.contains(lo) { out.append(lo) }
  }
  return out
}

func commonRate(_ a: [Float64], _ b: [Float64]) -> Float64 {
  for p in [Float64(48000), Float64(44100)] {
    if a.contains(p) && b.contains(p) { return p }
  }
  for r in a { if b.contains(r) { return r } }
  return 48000
}

func isRunning(_ id: AudioObjectID) -> Bool {
  var addr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere,
                                        mScope: kAudioObjectPropertyScopeGlobal,
                                        mElement: kAudioObjectPropertyElementMain)
  var v: UInt32 = 0
  var sz = UInt32(MemoryLayout<UInt32>.size)
  guard AudioObjectGetPropertyData(id, &addr, 0, nil, &sz, &v) == noErr else { return false }
  return v != 0
}

func outputStreamCount(_ id: AudioObjectID) -> Int {
  var addr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyStreams,
                                        mScope: kAudioObjectPropertyScopeOutput,
                                        mElement: kAudioObjectPropertyElementMain)
  var size: UInt32 = 0
  guard AudioObjectGetPropertyDataSize(id, &addr, 0, nil, &size) == noErr else { return 0 }
  return Int(size) / MemoryLayout<AudioStreamID>.size
}

func outputChannelCount(_ id: AudioObjectID) -> Int {
  var addr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyStreams,
                                        mScope: kAudioObjectPropertyScopeOutput,
                                        mElement: kAudioObjectPropertyElementMain)
  var size: UInt32 = 0
  guard AudioObjectGetPropertyDataSize(id, &addr, 0, nil, &size) == noErr, size > 0 else { return 0 }
  let count = Int(size) / MemoryLayout<AudioStreamID>.size
  var streams = [AudioStreamID](repeating: 0, count: count)
  guard AudioObjectGetPropertyData(id, &addr, 0, nil, &size, &streams) == noErr else { return 0 }
  var total = 0
  for s in streams {
    var fmt = AudioStreamBasicDescription()
    var fa = AudioObjectPropertyAddress(mSelector: kAudioStreamPropertyVirtualFormat,
                                        mScope: kAudioObjectPropertyScopeGlobal,
                                        mElement: kAudioObjectPropertyElementMain)
    var fs = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
    if AudioObjectGetPropertyData(s, &fa, 0, nil, &fs, &fmt) == noErr {
      total += Int(fmt.mChannelsPerFrame)
    }
  }
  return total
}

func speakersDeviceID() -> AudioObjectID? {
  // Prefer the physical built-in speakers; exclude BlackHole and our aggregate
  // (defaultOutputID() can point at a removed aggregate after we delete it).
  for id in deviceIDs() {
    let name = (cfString(id, kAudioObjectPropertyName) ?? "").lowercased()
    let uid = cfString(id, kAudioDevicePropertyDeviceUID) ?? ""
    if uid == AGGREGATE_UID || name.contains("blackhole") || !hasOutput(id) { continue }
    if name.contains("speaker") || name.contains("built-in") || name.contains("output") {
      return id
    }
  }
  for id in deviceIDs() {
    let name = (cfString(id, kAudioObjectPropertyName) ?? "").lowercased()
    let uid = cfString(id, kAudioDevicePropertyDeviceUID) ?? ""
    if uid == AGGREGATE_UID || name.contains("blackhole") || !hasOutput(id) { continue }
    return id
  }
  return nil
}

var masterChoice = false // conventional: Built-in Output is the clock master for manual multi-output use

func createMultiOutput() -> (ok: Bool, created: Bool, streams: Int, rate: Float64, error: String) {
  if exists() {
    return (true, false, outputStreamCount(findDevice(uid: AGGREGATE_UID) ?? kAudioObjectUnknown), 48000, "")
  }
  let defID = speakersDeviceID() ?? defaultOutputID()
  guard defID != kAudioObjectUnknown else { return (false, false, 0, 0, "no output device") }
  let defUID = cfString(defID, kAudioDevicePropertyDeviceUID) ?? ""
  guard let bh = blackholeDevice() else { return (false, false, 0, 0, "BlackHole not installed") }
  let bhUID = cfString(bh, kAudioDevicePropertyDeviceUID) ?? ""

  // Use a sample rate both devices actually support (don't hardcode 48 kHz).
  let rate = commonRate(availableRates(defID), availableRates(bh))
  setRate(defID, rate)
  setRate(bh, rate)

  var out: AudioObjectID = kAudioObjectUnknown
  // Make the master selectable per creation so both topologies can be A/B'd.
  // The default keeps BlackHole as the clock source because — on the macOS
  // builds we hit — a multi-output device only services the master leg, and
  // BlackHole is the leg that must carry audio for capture. The speakers are
  // slaved with drift compensation.
  let masterIsBlackhole = masterChoice
  let subDevices: [[String: Any]] = masterIsBlackhole
    ? [
        [kAudioSubDeviceUIDKey: bhUID, kAudioSubDeviceDriftCompensationKey: 0],
        [kAudioSubDeviceUIDKey: defUID, kAudioSubDeviceDriftCompensationKey: 1],
      ]
    : [
        [kAudioSubDeviceUIDKey: defUID, kAudioSubDeviceDriftCompensationKey: 0],
        [kAudioSubDeviceUIDKey: bhUID, kAudioSubDeviceDriftCompensationKey: 1],
      ]
  let masterUID = masterIsBlackhole ? bhUID : defUID
  let desc: [String: Any] = [
    kAudioAggregateDeviceNameKey as String: AGGREGATE_NAME,
    kAudioAggregateDeviceUIDKey as String: AGGREGATE_UID,
    kAudioAggregateDeviceSubDeviceListKey as String: subDevices,
    kAudioAggregateDeviceMainSubDeviceKey as String: masterUID,
    kAudioAggregateDeviceIsStackedKey as String: false,
    kAudioAggregateDeviceIsPrivateKey as String: false,
  ]
  let st = AudioHardwareCreateAggregateDevice(desc as CFDictionary, &out)
  guard st == noErr else { return (false, false, 0, 0, "create aggregate failed (\(st))") }

  // Explicitly bind the clock/time-base to the master device. Per CoreAudio,
  // setting kAudioAggregateDevicePropertyClockDevice both names the time base
  // AND enables drift correction for all sub-devices — without it the virtual
  // leg can free-run and never receive the master's timeline.
  var clockAddr = AudioObjectPropertyAddress(mSelector: kAudioAggregateDevicePropertyClockDevice,
                                              mScope: kAudioObjectPropertyScopeGlobal,
                                              mElement: kAudioObjectPropertyElementMain)
  var clockUID = masterUID as NSString as CFString
  withUnsafeMutablePointer(to: &clockUID) { p in
    AudioObjectSetPropertyData(out, &clockAddr, 0, nil,
                               UInt32(MemoryLayout<CFString>.size), p)
  }

  setRate(out, rate)
  setVolumeScalar(out, 1.0)
  // BlackHole's own input AND output volume must be up (BlackHole FAQ) or the
  // loopback is silent even though the aggregate routes correctly.
  setVolumeScalarScope(bh, 1.0, kAudioObjectPropertyScopeOutput)
  setVolumeScalarScope(bh, 1.0, kAudioObjectPropertyScopeInput)
  setVolumeScalarScope(defID, 1.0, kAudioObjectPropertyScopeOutput)
  let streams = outputStreamCount(out)
  return (streams > 0, true, streams, rate, "")
}

func handleCreate(_ force: Bool = false, _ masterIsBlackhole: Bool? = nil) {
  if let m = masterIsBlackhole { masterChoice = m }
  if force, let id = findDevice(uid: AGGREGATE_UID) {
    AudioHardwareDestroyAggregateDevice(id)
  }
  let r = createMultiOutput()
  if r.ok {
    printJson(["ok": true, "created": r.created, "uid": AGGREGATE_UID, "name": AGGREGATE_NAME,
               "outputStreams": r.streams, "outputChannels": outputChannelCount(findDevice(uid: AGGREGATE_UID) ?? 0), "sampleRate": r.rate])
  } else {
    printJson(["ok": false, "error": r.error])
  }
}

func cfProperty(_ obj: AudioObjectID, _ selector: AudioObjectPropertySelector) -> Any? {
  var addr = AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal,
                                        mElement: kAudioObjectPropertyElementMain)
  var size: UInt32 = 0
  guard AudioObjectGetPropertyDataSize(obj, &addr, 0, nil, &size) == noErr, size > 0 else { return nil }
  var cf: CFTypeRef?
  let st = withUnsafeMutablePointer(to: &cf) { p in
    AudioObjectGetPropertyData(obj, &addr, 0, nil, &size, UnsafeMutableRawPointer(p))
  }
  guard st == noErr, let c = cf else { return nil }
  return c as Any
}

func handleAggInfo() {
  guard let agg = findDevice(uid: AGGREGATE_UID) else {
    printJson(["ok": false, "error": "aggregate not installed"])
    return
  }
  var out: [String: Any] = ["ok": true]

  if let comp = cfProperty(agg, kAudioAggregateDevicePropertyComposition) {
    out["composition"] = String(describing: comp)
  }
  if let main = cfProperty(agg, kAudioAggregateDevicePropertyMainSubDevice) as? String {
    out["main"] = main
  }
  if let clock = cfProperty(agg, kAudioAggregateDevicePropertyClockDevice) as? String {
    out["clock"] = clock
  }
  if let uids = cfProperty(agg, kAudioAggregateDevicePropertyFullSubDeviceList) {
    out["subdevices"] = String(describing: uids)
  }
  if let d = getData(agg, kAudioAggregateDevicePropertyActiveSubDeviceList,
                     kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain) {
    let count = Int(d.1) / MemoryLayout<AudioObjectID>.size
    let ids = d.0.bindMemory(to: AudioObjectID.self, capacity: count)
    var names: [String] = []
    for i in 0..<count {
      let n = cfString(ids[i], kAudioObjectPropertyName) ?? "?"
      names.append("\(n) [\(ids[i])]")
    }
    out["active"] = names
    d.0.deallocate()
  }
  printJson(out)
}

func handleDefault() {
  let id = defaultOutputID()
  guard id != kAudioObjectUnknown else {
    printJson(["ok": false, "error": "no default output device"])
    return
  }
  let name = cfString(id, kAudioObjectPropertyName) ?? ""
  let uid = cfString(id, kAudioDevicePropertyDeviceUID) ?? ""
  printJson(["ok": true, "name": name, "uid": uid])
}

// MARK: - Input level measurement (1s capture → RMS)

var gLevelSum: Double = 0
var gLevelCount: UInt64 = 0
var gLevelUnit: AudioUnit?
var gLevelCalls: UInt64 = 0
var gLevelOkCalls: UInt64 = 0
var gLevelLastErr: Int32 = 0
var gLevelScratch: [UnsafeMutableRawPointer] = []
let LEVEL_SCRATCH_BYTES = 1 << 16
var gLevelABL: UnsafeMutablePointer<AudioBufferList>?
var gLevelABLCount = -1
var gLevelFramesReq: UInt32 = 0
var gLevelBytesAfter: UInt32 = 0
var gLevelBytesPerFrame: UInt32 = 0
var gLevelIoDataNil = false
var gLevelBus: UInt32 = 0

let gLevelCallback: AURenderCallback = { _, ioActionFlags, inTimeStamp, inBusNumber, inNumberFrames, ioData in
  gLevelCalls += 1
  guard let unit = gLevelUnit else { return noErr }
  if ioData == nil { gLevelIoDataNil = true }
  gLevelBus = inBusNumber
  // AUHAL may call with ioData == nil; render into our own buffer list then.
  guard let ablPtr = (ioData ?? gLevelABL) else { return noErr }
  let abl = UnsafeMutableAudioBufferListPointer(ablPtr)
  if gLevelABLCount < 0 {
    gLevelABLCount = abl.count
    gLevelFramesReq = inNumberFrames
  }
  // HAL rejects buffers that are not sized to exactly the requested frames.
  let needed = inNumberFrames * max(gLevelBytesPerFrame, 1)
  for i in 0..<abl.count {
    if abl[i].mData == nil {
      while gLevelScratch.count <= i {
        gLevelScratch.append(UnsafeMutableRawPointer.allocate(byteCount: LEVEL_SCRATCH_BYTES, alignment: 16))
      }
      abl[i].mData = gLevelScratch[i]
    }
    if needed > 0, UInt32(LEVEL_SCRATCH_BYTES) >= needed {
      abl[i].mDataByteSize = needed
    }
  }
  // Input arrives on bus 1 for AUHAL; trust it over the reported bus.
  let renderBus: UInt32 = ioData == nil ? 1 : inBusNumber
  let st = AudioUnitRender(unit, ioActionFlags, inTimeStamp, renderBus, inNumberFrames, ablPtr)
  if st != noErr {
    gLevelLastErr = st
    // Tolerate early errors: a loopback's capture side can take a moment to
    // start clocking once the first capture client attaches (-10863
    // CannotDoInPresentContext during spin-up).
    return noErr
  }
  gLevelOkCalls += 1
  for buf in abl {
    if gLevelBytesAfter == 0 { gLevelBytesAfter = buf.mDataByteSize }
    guard let data = buf.mData else { continue }
    let n = Int(buf.mDataByteSize) / MemoryLayout<Float>.size
    let p = data.assumingMemoryBound(to: Float.self)
    for i in 0..<n {
      let v = Double(p[i])
      gLevelSum += v * v
    }
    gLevelCount += UInt64(n)
  }
  return noErr
}

func handleLevel(_ frag: String, _ seconds: Double = 1.5) {
  let f = frag.lowercased()
  guard let dev = deviceIDs().first(where: { (cfString($0, kAudioObjectPropertyName) ?? "").lowercased().contains(f) }) else {
    printJson(["ok": false, "error": "device not found: \(frag)"])
    return
  }
  // Safety: never open a capture client on an idle device. Forcing Core Audio
  // to spin up a clock on a loopback with nothing feeding it can wedge
  // coreaudiod (and with it the whole system). Only measure a device that is
  // already running because audio is playing through it.
  if !isRunning(dev) {
    printJson(["ok": false, "error": "device is idle — play audio through the Multi-Output first, then retry"])
    return
  }
  var desc = AudioComponentDescription(
    componentType: kAudioUnitType_Output,
    componentSubType: kAudioUnitSubType_HALOutput,
    componentManufacturer: kAudioUnitManufacturer_Apple,
    componentFlags: 0, componentFlagsMask: 0)
  guard let comp = AudioComponentFindNext(nil, &desc) else {
    printJson(["ok": false, "error": "no audio component"])
    return
  }
  var unit: AudioUnit?
  guard AudioComponentInstanceNew(comp, &unit) == noErr, let au = unit else {
    printJson(["ok": false, "error": "could not open audio unit"])
    return
  }
  defer { AudioComponentInstanceDispose(au) }

  // Pure-input unit: disable the output side entirely, otherwise the unit
  // waits on an output render callback that never comes and the input
  // callback never fires.
  var zero: UInt32 = 0
  AudioUnitSetProperty(au, kAudioOutputUnitProperty_EnableIO, kAudioUnitScope_Output, 0,
                       &zero, UInt32(MemoryLayout<UInt32>.size))
  var flag: UInt32 = 1
  var st = AudioUnitSetProperty(au, kAudioOutputUnitProperty_EnableIO, kAudioUnitScope_Input, 1,
                                &flag, UInt32(MemoryLayout<UInt32>.size))
  guard st == noErr else { printJson(["ok": false, "error": "enable input failed (\(st))"]); return }

  var devID: AudioDeviceID = dev
  st = AudioUnitSetProperty(au, kAudioOutputUnitProperty_CurrentDevice, kAudioUnitScope_Global, 0,
                            &devID, UInt32(MemoryLayout<AudioDeviceID>.size))
  guard st == noErr else { printJson(["ok": false, "error": "select device failed (\(st))"]); return }

  var fmt = AudioStreamBasicDescription()
  var sz = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
  AudioUnitGetProperty(au, kAudioUnitProperty_StreamFormat, kAudioUnitScope_Input, 1, &fmt, &sz)

  // For capture, the client side of the input bus is scope OUTPUT, element 1.
  // Commit the device format there; the buffer list we render into must match.
  let setFmtSt = AudioUnitSetProperty(au, kAudioUnitProperty_StreamFormat, kAudioUnitScope_Output, 1, &fmt, sz)
  var clientFmt = AudioStreamBasicDescription()
  var clientFmtSz = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
  AudioUnitGetProperty(au, kAudioUnitProperty_StreamFormat, kAudioUnitScope_Output, 1, &clientFmt, &clientFmtSz)

  // Preallocate a buffer list for the callback to render into (AUHAL passes
  // ioData == nil), matching the client-side layout.
  let nCh = max(Int(clientFmt.mChannelsPerFrame), 1)
  let interleaved = (clientFmt.mFormatFlags & kAudioFormatFlagIsNonInterleaved) == 0
  let nBufs = interleaved ? 1 : nCh
  let bytesPerFramePerBuf = UInt32((interleaved ? nCh : 1) * MemoryLayout<Float>.size)
  gLevelBytesPerFrame = bytesPerFramePerBuf
  let scratchBytes = 4096 * Int(bytesPerFramePerBuf)
  while gLevelScratch.count < nBufs {
    gLevelScratch.append(UnsafeMutableRawPointer.allocate(byteCount: scratchBytes, alignment: 16))
  }
  let ablBytes = MemoryLayout<AudioBufferList>.size + max(0, nBufs - 1) * MemoryLayout<AudioBuffer>.stride
  let ablMem = UnsafeMutableRawPointer.allocate(byteCount: ablBytes, alignment: 8)
  let ablPtr = ablMem.bindMemory(to: AudioBufferList.self, capacity: 1)
  ablPtr.pointee.mNumberBuffers = UInt32(nBufs)
  let bufsBase = MemoryLayout<AudioBufferList>.offset(of: \AudioBufferList.mBuffers)!
  for i in 0..<nBufs {
    let b = ablMem.advanced(by: bufsBase + i * MemoryLayout<AudioBuffer>.stride)
      .bindMemory(to: AudioBuffer.self, capacity: 1)
    b.pointee.mNumberChannels = interleaved ? UInt32(nCh) : 1
    b.pointee.mDataByteSize = UInt32(scratchBytes)
    b.pointee.mData = gLevelScratch[i]
  }
  gLevelABL = ablPtr
  defer { ablMem.deallocate() }

  var cb = AURenderCallbackStruct(inputProc: gLevelCallback, inputProcRefCon: nil)
  st = AudioUnitSetProperty(au, kAudioOutputUnitProperty_SetInputCallback, kAudioUnitScope_Global, 0,
                            &cb, UInt32(MemoryLayout<AURenderCallbackStruct>.size))
  guard st == noErr else { printJson(["ok": false, "error": "set input callback failed (\(st))"]); return }

  gLevelSum = 0; gLevelCount = 0; gLevelCalls = 0; gLevelOkCalls = 0; gLevelLastErr = 0
  gLevelABLCount = -1; gLevelFramesReq = 0; gLevelBytesAfter = 0
  gLevelIoDataNil = false; gLevelBus = 0; gLevelUnit = au
  st = AudioUnitInitialize(au)
  guard st == noErr else { printJson(["ok": false, "error": "init failed (\(st))"]); return }
  st = AudioOutputUnitStart(au)
  guard st == noErr else { printJson(["ok": false, "error": "start failed (\(st))"]); return }
  usleep(1_500_000)
  AudioOutputUnitStop(au)
  gLevelUnit = nil
  gLevelABL = nil

  let rms = sqrt(gLevelSum / Double(max(gLevelCount, 1)))
  printJson(["ok": true, "device": cfString(dev, kAudioObjectPropertyName) ?? frag,
             "sampleRate": fmt.mSampleRate, "channels": fmt.mChannelsPerFrame,
             "nonInterleaved": (fmt.mFormatFlags & kAudioFormatFlagIsNonInterleaved) != 0,
             "samples": gLevelCount, "rms": rms,
             "callbacks": gLevelCalls, "okCalls": gLevelOkCalls, "renderErr": gLevelLastErr,
             "ablBuffers": gLevelABLCount, "framesReq": gLevelFramesReq, "bytesAfter": gLevelBytesAfter,
             "ioDataNil": gLevelIoDataNil, "bus": gLevelBus, "setFmt": setFmtSt,
             "clientRate": clientFmt.mSampleRate, "clientCh": clientFmt.mChannelsPerFrame,
             "clientNonInt": (clientFmt.mFormatFlags & kAudioFormatFlagIsNonInterleaved) != 0])
}

func handleSetup() {
  print("FlipFlip System Audio Setup")
  print("============================")
  print("")

  if !blackholeDriverInstalled() {
    print("BlackHole is NOT installed.")
    print("")
    print("Install it yourself with Homebrew (2 channels is all you need):")
    print("")
    print("    brew install blackhole-2ch")
    print("")
    print("(Or download the official installer: https://existential.audio/blackhole/)")
    print("")
    print("After installing, REBOOT your Mac so Core Audio loads the driver,")
    print("then run this setup again.")
    exit(0)
  }

  if blackholeDevice() == nil {
    print("BlackHole is installed but not loaded yet.")
    print("")
    print("Reboot your Mac (or run:  sudo killall coreaudiod ) and run this again.")
    exit(0)
  }

  print("BlackHole is installed and running.")
  print("")

  if exists() {
    if let id = findDevice(uid: AGGREGATE_UID) {
      _ = AudioHardwareDestroyAggregateDevice(id)
    }
    print("Removed the previous 'FlipFlip Multi-Output' device.")
  }

  let r = createMultiOutput()
  if r.ok && r.streams > 0 {
    print("Created 'FlipFlip Multi-Output' (speakers + BlackHole).")
    print("")
    print("Last step - select it as your output:")
    print("  System Settings -> Sound -> Output -> 'FlipFlip Multi-Output'")
    print("")
    print("Done. Audio will play to BOTH your speakers and the loopback,")
    print("so you hear it and FlipFlip can drive haptics from it.")
  } else {
    print("Could not create the Multi-Output automatically (\(r.error)).")
    print("")
    print("Create it manually in Audio MIDI Setup:")
    print("  1. Open /System/Applications/Utilities/Audio MIDI Setup.app")
    print("  2. Click '+' -> 'Create Multi-Output Device'")
    print("  3. Tick your speakers AND 'BlackHole 2ch'; on BlackHole tick 'Drift Correction'")
    print("  4. Set 'Master Device' to your speakers, Format 48,000 Hz")
  }
}

func handleDiagnose() {
  var res = [[String: Any]]()
  for d in deviceIDs() {
    let name = cfString(d, kAudioObjectPropertyName) ?? ""
    let uid = cfString(d, kAudioDevicePropertyDeviceUID) ?? ""
    var rate: Float64 = 0
    var addr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyNominalSampleRate,
                                          mScope: kAudioObjectPropertyScopeGlobal,
                                          mElement: kAudioObjectPropertyElementMain)
    var sz = UInt32(MemoryLayout<Float64>.size)
    AudioObjectGetPropertyData(d, &addr, 0, nil, &sz, &rate)
    res.append(["name": name, "uid": uid, "out": hasOutput(d), "channels": outputChannelCount(d), "rate": rate, "rates": availableRates(d), "running": isRunning(d), "volIn": volumeScalar(d, kAudioObjectPropertyScopeInput), "volOut": volumeScalar(d, kAudioObjectPropertyScopeOutput)])
  }
  res.sort { ($0["name"] as? String ?? "").lowercased() < ($1["name"] as? String ?? "").lowercased() }
  printJson(res)
}

func handleVerify() {
  guard let id = findDevice(uid: AGGREGATE_UID) else {
    printJson(["ok": false, "error": "not installed", "uid": AGGREGATE_UID])
    return
  }
  let streams = outputStreamCount(id)
  var addr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyNominalSampleRate,
                                        mScope: kAudioObjectPropertyScopeGlobal,
                                        mElement: kAudioObjectPropertyElementMain)
  var rate: Float64 = 0
  var sz = UInt32(MemoryLayout<Float64>.size)
  AudioObjectGetPropertyData(id, &addr, 0, nil, &sz, &rate)
  printJson(["ok": streams > 0, "uid": AGGREGATE_UID, "outputStreams": streams, "sampleRate": rate])
}

func handleRemove() {
  guard let id = findDevice(uid: AGGREGATE_UID) else {
    printJson(["ok": true, "removed": false])
    return
  }
  let st = AudioHardwareDestroyAggregateDevice(id)
  printJson(["ok": st == noErr, "removed": st == noErr, "uid": AGGREGATE_UID, "error": st == noErr ? "" : String(st)])
}

func handleStatus() {
  printJson(["installed": exists(), "uid": AGGREGATE_UID])
}

func handleSetDefault(_ uid: String) {
  guard exists(), let id = findDevice(uid: uid) else {
    printJson(["ok": false, "error": "device not found"])
    return
  }
  var addr = AudioObjectPropertyAddress(mSelector: kAudioHardwarePropertyDefaultOutputDevice,
                                        mScope: kAudioObjectPropertyScopeGlobal,
                                        mElement: kAudioObjectPropertyElementMain)
  var target = id
  let st = AudioObjectSetPropertyData(AudioObjectID(kAudioObjectSystemObject), &addr, 0, nil,
                                      UInt32(MemoryLayout<AudioObjectID>.size), &target)
  if st == noErr {
    printJson(["ok": true])
  } else {
    // Not allowed (0x77686F3F = 'who?') when the session lacks the right to
    // change the system default — the user can select it in Sound settings.
    printJson(["ok": false, "error": "\(st)"])
  }
}

// MARK: - Interactive menu

var gOrigTermios = termios()

func enableRawMode() {
  var t = termios()
  tcgetattr(STDIN_FILENO, &t)
  gOrigTermios = t
  var raw = t
  // Input-only raw mode: disable canonical mode + echo so we can read single
  // keypresses, but KEEP output post-processing (OPOST/ONLCR) so "\n" still
  // prints as a real carriage-return + newline (no stair-stepped output).
  raw.c_lflag &= ~tcflag_t(ICANON | ECHO | IEXTEN)
  raw.c_iflag &= ~tcflag_t(IXON | ICRNL)
  tcsetattr(STDIN_FILENO, TCSANOW, &raw)
}

func disableRawMode() {
  tcsetattr(STDIN_FILENO, TCSANOW, &gOrigTermios)
}

func readByte() -> Int {
  var c: UInt8 = 0
  return read(STDIN_FILENO, &c, 1) == 1 ? Int(c) : -1
}

func readKey() -> [Int] {
  let first = readByte()
  guard first >= 0 else { return [] }
  if first == 0x1B {
    let b = readByte()
    if b == 0x5B {
      let c = readByte()
      return c >= 0 ? [first, b, c] : [first, b]
    }
    return b >= 0 ? [first, b] : [first]
  }
  return [first]
}

let CLEAR = "\u{1B}[2J\u{1B}[H"
let BOLD = "\u{1B}[1m"
let DIM = "\u{1B}[2m"
let GREEN = "\u{1B}[32m"
let YELLOW = "\u{1B}[33m"
let RED = "\u{1B}[31m"
let CYAN = "\u{1B}[36m"
let RESET = "\u{1B}[0m"

func pauseForKey() {
  print("\nPress any key to return to the menu…")
  _ = readKey()
}

func bhStatusText() -> String {
  if !blackholeDriverInstalled() { return RED + "not installed" + RESET }
  if blackholeDevice() == nil { return YELLOW + "installed (reboot required)" + RESET }
  return GREEN + "installed & running" + RESET
}

func multiOutText() -> String {
  guard let id = findDevice(uid: AGGREGATE_UID) else { return RED + "not created" + RESET }
  return GREEN + "present (\(outputChannelCount(id)) output channels)" + RESET
}

struct MenuItem { let title: String; let run: () -> Void; let quits: Bool }

func buildMenuItems() -> [MenuItem] {
  return [
    MenuItem(title: "Check BlackHole status", run: {
      print(CLEAR)
      print(CYAN + "BlackHole: " + RESET + bhStatusText())
      print("")
      print(DIM + "No Multi-Output device is needed anymore — FlipFlip" + RESET)
      print(DIM + "routes your Mac's output to BlackHole automatically" + RESET)
      print(DIM + "and plays it back to your speakers/AirPods itself." + RESET)
      print("")
      pauseForKey()
    }, quits: false),

    MenuItem(title: "Install BlackHole — show instructions", run: {
      print(CLEAR)
      print("Install BlackHole (2 channels) with Homebrew:")
      print("")
      print("    brew install blackhole-2ch")
      print("")
      print("Or download: https://existential.audio/blackhole/")
      print("")
      print("Then REBOOT your Mac so Core Audio loads the driver,")
      print("and run this menu again.")
      pauseForKey()
    }, quits: false),

    MenuItem(title: "Troubleshoot a silent capture", run: {
      print(CLEAR)
      print("If FlipFlip shows 'No audio detected':")
      print("")
      print("1. Make sure something is actually playing (music/video).")
      print("2. Allow Microphone for FlipFlip when macOS asks")
      print("   (System Settings → Privacy & Security → Microphone).")
      print("3. If BlackHole was just installed, reboot the Mac")
      print("   (or run 'sudo killall coreaudiod' from a Terminal).")
      print("4. In the Haptic Card, turn OFF then ON 'System Audio',")
      print("   or use the 'Fix Audio Routing' button.")
      print("")
      pauseForKey()
    }, quits: false),

    MenuItem(title: "Diagnose audio devices", run: {
      print(CLEAR)
      for d in deviceIDs() {
        let name = (cfString(d, kAudioObjectPropertyName) ?? "(unnamed)").padding(toLength: 30, withPad: " ", startingAt: 0)
        var rate: Float64 = 0
        var addr = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyNominalSampleRate,
                                              mScope: kAudioObjectPropertyScopeGlobal,
                                              mElement: kAudioObjectPropertyElementMain)
        var sz = UInt32(MemoryLayout<Float64>.size)
        AudioObjectGetPropertyData(d, &addr, 0, nil, &sz, &rate)
        let out = hasOutput(d) ? "out" : "   "
        let running = isRunning(d) ? "running" : "idle"
        print("  \(name)  \(out)  \(Int(rate)) Hz  \(running)")
      }
      pauseForKey()
    }, quits: false),

    MenuItem(title: "Quit", run: {}, quits: true),
  ]
}

func renderMenu(_ items: [MenuItem], _ selected: Int) {
  print(CLEAR)
  print(BOLD + "FlipFlip System Audio Setup" + RESET)
  print(DIM + "↑/↓ move · Enter select · q quit" + RESET)
  print(DIM + "FlipFlip now routes to BlackHole automatically — no Multi-Output needed." + RESET)
  print("")
  for (i, item) in items.enumerated() {
    if i == selected {
      print(GREEN + "▶ " + BOLD + item.title + RESET)
    } else {
      print("  " + item.title)
    }
  }
}

func runMenu() {
  let items = buildMenuItems()
  var selected = 0
  enableRawMode()
  defer { disableRawMode() }
  while true {
    renderMenu(items, selected)
    let key = readKey()
    if key == [0x1B, 0x5B, 0x41] { selected = max(0, selected - 1) }
    else if key == [0x1B, 0x5B, 0x42] { selected = min(items.count - 1, selected + 1) }
    else if key == [13] || key == [10] {
      let item = items[selected]
      if item.quits { break }
      item.run()
    } else if key == [113] || key == [81] { break }
    else if let c = key.first, c >= 49, c <= 54 {
      let idx = c - 49
      if idx >= 0 && idx < items.count {
        let item = items[idx]
        if item.quits { break }
        item.run()
      }
    }
  }
  print(CLEAR)
}

let args = Array(CommandLine.arguments.dropFirst())
if args.isEmpty {
  runMenu()
} else {
  switch args[0] {
  case "list": handleList()
  case "create":
    var createForce = false
    var createMaster: Bool? = nil
    for a in args.dropFirst() {
      if a == "--force" { createForce = true }
      else if a == "--master=speakers" { createMaster = false }
      else if a == "--master=blackhole" { createMaster = true }
    }
    handleCreate(createForce, createMaster)
  case "verify": handleVerify()
  case "agginfo": handleAggInfo()
  case "diagnose": handleDiagnose()
  case "remove": handleRemove()
  case "status": handleStatus()
  case "setup": handleSetup()
  case "menu": runMenu()
  case "default": handleDefault()
  case "level":
    guard args.count >= 2, !args[1].isEmpty else { fail("usage: level <device name fragment> [seconds]") }
    let seconds = args.count >= 3 ? (Double(args[2]) ?? 1.5) : 1.5
    handleLevel(args[1], seconds)
  case "set-default":
    guard args.count >= 2, !args[1].isEmpty else { fail("usage: set-default <uid>") }
    handleSetDefault(args[1])
  default: fail("usage: (menu) | list | create [--force] | verify | diagnose | remove | status | setup | default | level <device> | set-default <uid>")
  }
}
