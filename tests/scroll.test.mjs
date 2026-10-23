import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolate } from '../web/src/scroll.ts';

test('maps source centers proportionally between unequal rendered block heights', () => {
  const anchors = [{ source: 0, target: 0 }, { source: 100, target: 300 }, { source: 400, target: 500 }];
  assert.equal(interpolate(50, anchors), 150);
  assert.equal(interpolate(250, anchors), 400);
  assert.equal(interpolate(100, anchors), 300);
  const reverse = anchors.map(({source, target}) => ({source: target, target: source}));
  assert.equal(interpolate(400, reverse), 250);
});

test('clamps document edges and handles one-point or empty documents', () => {
  assert.equal(interpolate(-100, [{source: 0, target: 10}, {source: 100, target: 300}]), 10);
  assert.equal(interpolate(1000, [{source: 0, target: 10}, {source: 100, target: 300}]), 300);
  assert.equal(interpolate(300, [{source: 100, target: 20}]), 20);
  assert.equal(interpolate(30, []), 30);
  assert.equal(interpolate(NaN, []), 0);
});

test('sorts without mutating input; duplicate source points avoid division by zero', () => {
  const anchors = [{source: 10, target: 20}, {source: 0, target: 0}, {source: 10, target: 30}, {source: NaN, target: 500}];
  assert.equal(interpolate(5, anchors), 15);
  assert.equal(anchors[0].source, 10);
  assert.equal(interpolate(NaN, anchors), 0);
});
