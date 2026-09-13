const origMapValues = Map.prototype.values;
Map.prototype.values = function (this: Map<any, any>) {
  return [...origMapValues.call(this)] as any;
};

import * as React from 'react';
import {createRoot} from 'react-dom/client';

import Meta from './components/Meta';
import './style.css';

const root = createRoot(document.getElementById('app')!);
root.render(<Meta/>);