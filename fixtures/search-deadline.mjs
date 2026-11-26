import {performance} from 'node:perf_hooks';

export const caseIds = Object.freeze(['steady-control', 'late-index']);
export const deadlineMs = 12;
const documents = Object.freeze([
  Object.freeze({id: 'doc-03', topic: 'compiler'}),
  Object.freeze({id: 'doc-17', topic: 'orchid'}),
  Object.freeze({id: 'doc-41', topic: 'volcano'}),
]);
const byTopic = new Map(documents.map(doc => [doc.topic, doc.id]));
const query = 'orchid';

export function search(caseId, trial, variant) {
  if (!caseIds.includes(caseId) || !Number.isInteger(trial) || trial < 1 || trial > 3
      || !['broken', 'repaired'].includes(variant)) {
    throw new TypeError('Expected a known case, trial 1–3, and broken or repaired variant');
  }
  const useScan = caseId === 'late-index' && variant === 'broken';
  const delayMs = useScan && trial === 2 ? 30 : 2;
  const started = performance.now();
  return new Promise(resolve => {
    const finish = (ids, timedOut) => {
      clearTimeout(workTimer);
      clearTimeout(deadlineTimer);
      resolve({ids, expectedIds: ['doc-17'], timedOut,
               durationMs: performance.now() - started, delayMs});
    };
    const workTimer = setTimeout(() => {
      const ids = useScan
        ? documents.filter(doc => doc.topic === query).map(doc => doc.id)
        : [byTopic.get(query)];
      finish(ids, false);
    }, delayMs);
    const deadlineTimer = setTimeout(() => finish([], true), deadlineMs);
  });
}
