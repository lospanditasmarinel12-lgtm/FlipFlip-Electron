import {ipcRenderer, IpcRendererEvent} from 'electron';
import * as remote from '@electron/remote';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { produce, setAutoFreeze } from "immer";

// This codebase updates state in place (actions mutate objects and return the
// same references). Immmer's autoFreeze treats those in-place writes on old
// state as errors, which silently breaks scene toggles and crashes the settings
// save flow. Disable it to match the mutation-based architecture.
setAutoFreeze(false);

import BluetoothDevicePicker from './player/BluetoothDevicePicker';

import {
  Alert,
  Box,
  createTheme,
  CssBaseline,
  Dialog,
  DialogContent,
  DialogContentText,
  Slide,
  Snackbar,
} from "@mui/material";
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';

import {IPC, SP} from "../data/const";
import {getCachePath} from "../data/utils";
import * as actions from '../data/actions';
import ErrorBoundary from "../../main/ErrorBoundary";
import AppStorage from '../data/AppStorage';
import ScenePicker from './ScenePicker';
import ConfigForm from './config/ConfigForm';
import Library from './library/Library';
import TagManager from "./library/TagManager";
import GridSetup from "./config/GridSetup";
import VideoClipper from "./config/VideoClipper";
import Player from './player/Player';
import SceneDetail from './sceneDetail/SceneDetail';
import Tutorial from "./Tutorial";
import AudioLibrary from "./library/AudioLibrary";
import CaptionScriptor from "./sceneDetail/CaptionScriptor";
import ScriptLibrary from "./library/ScriptLibrary";
import { useStore } from "../stores/flipflipStore";
import { getMemoryGovernor } from "../data/MemoryMonitor";
import { computeDisplayAutoConfig } from "../data/AutoConfig";
import { SystemCapabilities } from "../../main/SystemCapabilities";

import initMemoryDebug from "../data/MemoryDebug";
import { applyLogSettings, initLogging, isLogEnabled } from "../data/logging";
import { MediaBudget } from "../data/MediaBudget";

initLogging();

const appStorage = new AppStorage(remote.getCurrentWindow().id);

getMemoryGovernor(Math.round(require('os').totalmem() / (1024 * 1024))).start();
initMemoryDebug();

function TransitionUp(props: any) {
  return <Slide {...props} direction="up" />;
}

export default function Meta() {
  const state = useStore();

  const queueSave = useRef(false);
  const lastSave = useRef<Date | null>(null);

  const getFullState = useCallback(() => useStore.getState(), []);

  useEffect(() => {
    useStore.setState(appStorage.initialState);

    // Disable react-sound's verbose console output (soundmanager2)
    try {
      (window as any).soundManager?.setup({debugMode: false});
    } catch (e) {}

    const config = appStorage.initialState?.config;
    if (config?.logSettings) {
      applyLogSettings(config.logSettings);
    }
    if (config?.displaySettings?.maxInMemory) {
      MediaBudget.setBudget(config.displaySettings.maxInMemory * 2);
    }
    if (config?.displaySettings?.autoConfigEnabled) {
      ipcRenderer.invoke(IPC.systemCapabilities).then((caps: SystemCapabilities | null) => {
        console.log('[FlipFlip] System capabilities:', caps);
        if (!caps) return;
        const hasRisky = caps.gpuVendor === 'nvidia' && caps.platform === 'linux' && caps.displayServer === 'X11';
        const autoCfg = computeDisplayAutoConfig(
          caps.systemRAM_MB, caps.vramMB, caps.isDedicatedGPU,
          hasRisky, caps.isRemoteSession
        );
        const store = useStore.getState() as any;
        if (!store?.config?.displaySettings?.autoConfigEnabled) return;
        const next = produce(store, (draft: any) => {
          draft.config.displaySettings.maxInMemory = autoCfg.maxInMemory;
          draft.config.displaySettings.maxInHistory = autoCfg.maxInHistory;
          draft.config.displaySettings.maxLoadingAtOnce = autoCfg.maxLoadingAtOnce;
          draft.config.displaySettings.maxDecodedImages = autoCfg.maxDecodedImages;
          draft.config.caching.maxSize = autoCfg.cacheMaxSizeMB;
        });
        useStore.setState(next);
        console.log('[FlipFlip] Auto-config applied:', autoCfg);
      });
    }

    const handleStartScene = (_ev: IpcRendererEvent, sceneName: string) => {
      const st = useStore.getState() as any;
      const next = produce(st, (draft: any) => {
        (draft as any)._setState = (next: any) => useStore.setState(next);
        const result = (actions as any).startFromScene(draft, sceneName);
        if (result) Object.assign(draft, result);
      });
      useStore.setState(next);
    };

    ipcRenderer.on(IPC.startScene, handleStartScene);

    if (remote.getCurrentWindow().id == 1) {
      const id = setInterval(() => {
        if (queueSave.current && (lastSave.current == null || Date.now() - lastSave.current.getTime() > 3000)) {
          appStorage.save(useStore.getState());
          lastSave.current = new Date();
          queueSave.current = false;
        }
      }, 500);
      // Only sample the heap when the 'memory' log namespace is enabled;
      // otherwise `process.memoryUsage()` every 15s is pure overhead.
      let heapId: ReturnType<typeof setInterval> = null;
      if (isLogEnabled('memory')) {
        const heapLog = () => {
          const mem = process.memoryUsage();
          const rss = Math.round(mem.rss / 1048576);
          const heapUsed = Math.round(mem.heapUsed / 1048576);
          const heapTotal = Math.round(mem.heapTotal / 1048576);
          const ext = Math.round(mem.external / 1048576);
          const perf = (performance as any).memory;
          const jsHeapUsed = perf ? Math.round(perf.usedJSHeapSize / 1048576) : 0;
          const jsHeapLimit = perf ? Math.round(perf.jsHeapSizeLimit / 1048576) : 0;
          console.log(`[Heap] rss:${rss}MB heapUsed:${heapUsed}MB heapTotal:${heapTotal}MB external:${ext}MB jsHeap:${jsHeapUsed}/${jsHeapLimit}MB`);
        };
        heapLog();
        heapId = setInterval(heapLog, 15000);
      }
      return () => {
        ipcRenderer.removeListener(IPC.startScene, handleStartScene);
        clearInterval(id);
        clearInterval(heapId);
      };
    }
    return () => {
      ipcRenderer.removeListener(IPC.startScene, handleStartScene);
    };
  }, []);

  const applyAction = useCallback((fn: any, ...args: any[]) => {
    const originalState = useStore.getState() as any;
    const nextState = produce(originalState, (draft: any) => {
      (draft as any)._setState = (next: any) => useStore.setState(next);
      const result = fn(draft, ...args);
      if (result) Object.assign(draft, result);
    });
    if ((window as any).logStateChanges) console.log(nextState);
    useStore.setState(nextState);
  }, []);

  const progressAction = useCallback((fn: any, ...args: any[]) => {
    const getter = () => useStore.getState();
    fn(getter, (next: any) => useStore.setState(next), ...args);
  }, []);

  const isRoute = useCallback((kind: string): boolean => {
    return (actions as any).isRoute(useStore.getState(), kind);
  }, [state.route]);

  useEffect(() => {
    if (state.config?.logSettings) {
      applyLogSettings(state.config.logSettings);
    }
    if (state.config?.displaySettings?.maxInMemory) {
      MediaBudget.setBudget(state.config.displaySettings.maxInMemory * 2);
    }
  }, [state.config]);

  useEffect(() => {
    queueSave.current = true;
  }, [
    state.version, state.config, state.scenes, state.sceneGroups, state.grids,
    state.library, state.audios, state.scripts, state.playlists, state.tags,
    state.route, state.specialMode, state.openTab, state.displayedSources,
    state.libraryYOffset, state.libraryFilters, state.librarySelected,
    state.audioOpenTab, state.audioYOffset, state.audioFilters, state.audioSelected,
    state.scriptYOffset, state.scriptFilters, state.scriptSelected,
    state.progressMode, state.progressNext,
    state.systemMessage, state.systemSnackOpen, state.systemSnack,
    state.tutorial, state.theme,
  ]);

  const theme = useMemo(() => createTheme(state.theme), [state.theme]);

  const a = (fn: any, ...args: any[]) => applyAction.bind(null, fn, ...args);
  const p = (fn: any) => progressAction.bind(null, fn);

  const scene = (actions as any).getActiveScene(state);
  const grid = (actions as any).getActiveGrid(state);

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <ErrorBoundary
          version={state.version}
          onRestore={a(actions.restoreFromBackup)}
          goBack={a(actions.goBack)}>
          <Box className="Meta">
            <CssBaseline />
            <BluetoothDevicePicker />
            {state.route.length === 0 && (
              <ScenePicker
                canGenerate={state.library.length >= 1}
                canGrid={state.scenes.length > 0}
                config={state.config}
                grids={state.grids}
                audioLibraryCount={state.audios.length}
                scriptLibraryCount={state.scripts.length}
                libraryCount={state.library.length}
                openTab={state.openTab}
                scenes={state.scenes}
                sceneGroups={state.sceneGroups}
                tutorial={state.tutorial}
                version={state.version}
                onAddGenerator={a(actions.addGenerator)}
                onAddGrid={a(actions.addGrid)}
                onAddGroup={a(actions.addSceneGroup)}
                onAddScene={a(actions.addScene)}
                onChangeTab={a(actions.changeScenePickerTab)}
                onDeleteGroup={a(actions.deleteSceneGroup)}
                onDeleteScenes={a(actions.deleteScenes)}
                onImportScene={a(actions.importScene)}
                onOpenConfig={a(actions.openConfig)}
                onOpenAudioLibrary={a(actions.openAudios)}
                onOpenScriptLibrary={a(actions.openScripts)}
                onOpenCaptionScriptor={a(actions.openScriptor)}
                onOpenLibrary={a(actions.openLibrary)}
                onOpenScene={a(actions.goToScene)}
                onOpenGrid={a(actions.goToGrid)}
                onTutorial={a(actions.doneTutorial)}
                onSort={a(actions.sortScene)}
                onUpdateConfig={a(actions.updateConfig)}
                onUpdateGroups={a(actions.replaceSceneGroups)}
                onUpdateScenes={a(actions.replaceScenes)}
                onUpdateGrids={a(actions.replaceGrids)}
                startTutorial={a(actions.startTutorial)}
                systemMessage={a(actions.systemMessage)}
              />
            )}

            {isRoute('scene') && (
              <SceneDetail
                autoEdit={state.specialMode == SP.autoEdit}
                allScenes={state.scenes}
                allSceneGrids={state.grids}
                config={state.config}
                library={state.library}
                scene={scene}
                tags={state.tags}
                tutorial={state.tutorial}
                goBack={a(actions.goBack)}
                onAddSource={a(actions.addSource)}
                onAddTracks={a(actions.addTracks)}
                onAddScript={a(actions.addScript)}
                onClearBlacklist={a(actions.clearBlacklist)}
                onClip={a(actions.clipVideo)}
                onCloneScene={a(actions.cloneScene)}
                onDelete={a(actions.deleteScene)}
                onDownload={a(actions.downloadSource)}
                onEditBlacklist={a(actions.editBlacklist)}
                onExport={a(actions.exportScene)}
                onGenerate={a(actions.generateScenes)}
                onPlayScene={a(actions.playScene)}
                onPlay={a(actions.playSceneFromLibrary)}
                onPlayAudio={a(actions.playAudio)}
                onPlayScript={a(actions.playScript)}
                onResetScene={a(actions.resetScene)}
                onSaveAsScene={a(actions.saveScene)}
                onSort={a(actions.sortSources)}
                onTutorial={a(actions.doneTutorial)}
                onUpdateScene={a(actions.updateScene)}
                systemMessage={a(actions.systemMessage)}
              />
            )}

            {isRoute('library') && (
              <Library
                config={state.config}
                filters={state.libraryFilters}
                library={state.library}
                selected={state.librarySelected}
                specialMode={state.specialMode}
                tags={state.tags}
                tutorial={state.tutorial}
                yOffset={state.libraryYOffset}
                goBack={a(actions.goBack)}
                onAddSource={a(actions.addSource)}
                onBatchClip={a(actions.batchClip)}
                onBatchTag={a(actions.batchTag)}
                onClearBlacklist={a(actions.clearBlacklist)}
                onEditBlacklist={a(actions.editBlacklist)}
                onClip={a(actions.clipVideo)}
                onDownload={a(actions.downloadSource)}
                onExportLibrary={a(actions.exportLibrary)}
                onImportFromLibrary={a(actions.importFromLibrary)}
                onImportLibrary={a(actions.importLibrary, appStorage.backup.bind(appStorage, useStore.getState()))}
                onImportInstagram={p(actions.importInstagram)}
                onImportReddit={p(actions.importReddit)}
                onImportTumblr={p(actions.importTumblr)}
                onImportTwitter={p(actions.importTwitter)}
                onManageTags={a(actions.manageTags)}
                onMarkOffline={p(actions.markOffline)}
                onPlay={a(actions.playSceneFromLibrary)}
                onSort={a(actions.sortSources)}
                onTutorial={a(actions.doneTutorial)}
                onUpdateLibrary={a(actions.updateLibrary)}
                onUpdateMode={a(actions.setMode)}
                onUpdateVideoMetadata={p(actions.updateVideoMetadata)}
                savePosition={a(actions.saveLibraryPosition)}
                systemMessage={a(actions.systemMessage)}
              />
            )}

            {isRoute('audios') && (
              <AudioLibrary
                cachePath={getCachePath(null, state.config)}
                filters={state.audioFilters}
                library={state.audios}
                openTab={state.audioOpenTab}
                playlists={state.playlists}
                selected={state.audioSelected}
                specialMode={state.specialMode}
                tags={state.tags}
                tutorial={state.tutorial}
                yOffset={state.audioYOffset}
                goBack={a(actions.goBack)}
                onAddToPlaylist={a(actions.addToPlaylist)}
                onBatchTag={a(actions.batchTag)}
                onBatchEdit={a(actions.batchEdit)}
                onBatchDetectBPM={p(actions.detectBPMs)}
                onChangeTab={a(actions.changeAudioLibraryTab)}
                onImportFromLibrary={a(actions.importAudioFromLibrary)}
                onManageTags={a(actions.manageTags)}
                onPlay={a(actions.playAudio)}
                onSort={a(actions.sortAudioSources)}
                onSortPlaylist={a(actions.sortPlaylist)}
                onTutorial={a(actions.doneTutorial)}
                onUpdateLibrary={a(actions.updateAudioLibrary)}
                onUpdatePlaylists={a(actions.updatePlaylists)}
                onUpdateMode={a(actions.setMode)}
                savePosition={a(actions.saveAudioPosition)}
                systemMessage={a(actions.systemMessage)}
              />
            )}

            {isRoute('scripts') && (
              <ScriptLibrary
                allScenes={state.scenes}
                filters={state.scriptFilters}
                library={state.scripts}
                selected={state.scriptSelected}
                specialMode={state.specialMode}
                tags={state.tags}
                tutorial={state.tutorial}
                yOffset={state.scriptYOffset}
                goBack={a(actions.goBack)}
                onBatchTag={a(actions.batchTag)}
                onEditScript={a(actions.openScriptInScriptor)}
                onImportFromLibrary={a(actions.importScriptFromLibrary)}
                onImportToScriptor={a(actions.importScriptToScriptor)}
                onManageTags={a(actions.manageTags)}
                onPlay={a(actions.playScript)}
                onSort={a(actions.sortScripts)}
                onTutorial={a(actions.doneTutorial)}
                onUpdateLibrary={a(actions.updateScriptLibrary)}
                onUpdateMode={a(actions.setMode)}
                onUpdateScript={a(actions.updateScript)}
                savePosition={a(actions.saveScriptPosition)}
                systemMessage={a(actions.systemMessage)}
              />
            )}

            {isRoute('tags') && (
              <TagManager
                tags={state.tags}
                goBack={a(actions.goBack)}
                onSort={a(actions.sortTags)}
                onUpdateTags={a(actions.updateTags)}
              />
            )}

            {isRoute('clip') && (
              <VideoClipper
                allTags={state.tags}
                source={actions.getActiveSource(getFullState())}
                isLibrary={!(actions as any).getActiveScene(getFullState())}
                tutorial={state.tutorial}
                videoVolume={state.config.defaultScene.videoVolume}
                onTutorial={a(actions.doneTutorial)}
                onStartVCTutorial={a(actions.startVCTutorial)}
                onSetDisabledClips={a(actions.setDisabledClips)}
                onUpdateClips={a(actions.onUpdateClips)}
                goBack={a(actions.goBack)}
                navigateClipping={a(actions.navigateClipping)}
                cache={a(actions.cacheImage)}
              />
            )}

            {isRoute('grid') && (
              <GridSetup
                allScenes={state.scenes}
                autoEdit={state.specialMode == SP.autoEdit}
                scene={grid}
                tutorial={state.tutorial}
                goBack={a(actions.goBack)}
                onDelete={a(actions.deleteGrid)}
                onGenerate={a(actions.generateScenes)}
                onPlayGrid={a(actions.playGrid)}
                onTutorial={a(actions.doneTutorial)}
                onUpdateGrid={a(actions.updateGrid)}
              />
            )}

            {isRoute('play') && (
              <Player
                preventSleep
                config={state.config}
                scene={scene}
                scenes={state.scenes}
                sceneGrids={state.grids}
                theme={theme}
                tutorial={state.tutorial}
                onGenerate={a(actions.generateScenes)}
                onUpdateScene={a(actions.updateScene)}
                nextScene={a(actions.nextScene)}
                goBack={a(actions.goBack)}
                playTrack={a(actions.playTrack)}
                goToTagSource={a(actions.playSceneFromLibrary)}
                goToClipSource={a(actions.clipVideo)}
                getTags={actions.getTags.bind(null, state.library)}
                setCount={a(actions.setCount)}
                cache={a(actions.cacheImage)}
                blacklistFile={a(actions.blacklistFile)}
                systemMessage={a(actions.systemMessage)}
              />
            )}

            {isRoute('libraryplay') && (
              <Player
                preventSleep
                config={state.config}
                scene={scene}
                scenes={state.scenes}
                sceneGrids={state.grids}
                theme={theme}
                tutorial={state.tutorial}
                onGenerate={a(actions.generateScenes)}
                onUpdateScene={a(actions.updateScene)}
                goBack={a(actions.endPlaySceneFromLibrary)}
                playTrack={a(actions.playTrack)}
                tags={scene.audioScene ? actions.getAudioSource(getFullState())?.tags : scene.scriptScene ? actions.getScriptSource(getFullState())?.tags : actions.getLibrarySource(getFullState())?.id != -1 ? actions.getLibrarySource(getFullState())?.tags : null}
                allTags={state.tags}
                toggleTag={scene.audioScene ? a(actions.toggleAudioTag) : scene.scriptScene ? a(actions.toggleScriptTag) : a(actions.toggleTag)}
                inheritTags={scene.audioScene || scene.scriptScene ? undefined : a(actions.inheritTags)}
                navigateTagging={a(actions.navigateDisplayedLibrary)}
                getTags={actions.getTags.bind(null, state.library)}
                changeAudioRoute={scene.audioScene ? a(actions.changeAudioRoute) : undefined}
                setCount={a(actions.setCount)}
                cache={a(actions.cacheImage)}
                goToClipSource={a(actions.clipVideo)}
                blacklistFile={a(actions.blacklistFile)}
                systemMessage={a(actions.systemMessage)}
              />
            )}

            {isRoute('gridplay') && (
              <Player
                preventSleep
                config={state.config}
                scene={scene}
                scenes={state.scenes}
                sceneGrids={state.grids}
                theme={theme}
                tutorial={state.tutorial}
                onGenerate={a(actions.generateScenes)}
                onUpdateScene={a(actions.updateScene)}
                nextScene={a(actions.nextScene)}
                goBack={a(actions.endPlaySceneGrid)}
                playTrack={a(actions.playTrack)}
                goToTagSource={a(actions.playSceneFromLibrary)}
                goToClipSource={a(actions.clipVideo)}
                getTags={actions.getTags.bind(null, state.library)}
                setCount={a(actions.setCount)}
                cache={a(actions.cacheImage)}
                blacklistFile={a(actions.blacklistFile)}
                systemMessage={a(actions.systemMessage)}
              />
            )}

            {isRoute('config') && (
              <ConfigForm
                config={state.config}
                library={state.library}
                scenes={state.scenes}
                sceneGrids={state.grids}
                tags={state.tags}
                theme={state.theme}
                goBack={a(actions.goBack)}
                onBackup={appStorage.backup.bind(appStorage, getFullState())}
                onChangeThemeColor={a(actions.changeThemeColor)}
                onClean={() => (actions as any).cleanBackups(state.config)}
                onDefault={a(actions.setDefaultConfig)}
                onRestore={a(actions.restoreFromBackup)}
                onResetTutorials={a(actions.resetTutorials)}
                onToggleDarkMode={a(actions.toggleDarkMode)}
                onUpdateConfig={a(actions.updateConfig)}
              />
            )}

            {isRoute('scriptor') && (
              <CaptionScriptor
                config={state.config}
                scenes={state.scenes}
                sceneGrids={state.grids}
                tutorial={state.tutorial}
                openScript={(actions as any).getSelectScript(state)}
                theme={theme}
                onAddFromLibrary={a(actions.addScriptSingle)}
                getTags={actions.getTags.bind(null, state.library)}
                goBack={a(actions.goBack)}
                onUpdateScene={a(actions.updateScene)}
                onUpdateLibrary={a(actions.updateScriptLibrary)}
              />
            )}

            <Dialog
              open={!!state.systemMessage}
              onClose={a(actions.closeMessage)}
              aria-describedby="message-description">
              <DialogContent>
                <DialogContentText id="message-description">
                  {state.systemMessage}
                </DialogContentText>
              </DialogContent>
            </Dialog>

            <Snackbar
              open={state.systemSnackOpen}
              anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
              autoHideDuration={2000}
              key={state.systemSnack + new Date()}
              onClose={a(actions.closeMessage)}
              TransitionComponent={TransitionUp}>
              <Alert onClose={a(actions.closeMessage)} severity={state.systemSnackSeverity}>
                {state.systemSnack}
              </Alert>
            </Snackbar>

            {state.tutorial && (
              <Tutorial
                config={state.config}
                route={state.route}
                scene={!!scene ? scene : grid}
                tutorial={state.tutorial}
                onSetTutorial={a(actions.setTutorial)}
                onDoneTutorial={a(actions.doneTutorial)}
                onSkipAllTutorials={a(actions.skipTutorials)}
              />
            )}
          </Box>
        </ErrorBoundary>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}

(Meta as any).displayName = "Meta";