import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import { decodeDoipFrame, type DecodedDoipFrame } from './doip';

const execFileAsync = promisify(execFile);
const CAPTURE_FILTER = 'tcp port 13400 or udp port 13400';
const MAX_EVENTS = 2000;
const MAX_STREAM_BUFFER = 4 * 1024 * 1024;

export type TsharkInterface = {
  id: string;
  label: string;
  raw: string;
};

