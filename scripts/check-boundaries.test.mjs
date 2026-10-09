import { afterAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildsRawHtml, checkBoundaries, importsOf } from './check-boundaries.mjs';

describe('importsOf : les imports sont lus comme TypeScript les lit', () => {
  it('trouve les imports sur plusieurs lignes, même avec une apostrophe ou un point-virgule en commentaire', () => {
    expect(importsOf("import {\n  createApp, // l'API\n} from '../../../backend/src/app';")).toEqual(['../../../backend/src/app']);
    expect(importsOf("import {\n  x, // la carte ; non\n} from '../../carte/src/x';")).toEqual(['../../carte/src/x']);
  });

  it('trouve les import() avec commentaire ou en gabarit, export … from, import type, require', () => {
    expect(importsOf("const m = await import(/* @vite-ignore */ '../../../backend/src/app');")).toEqual(['../../../backend/src/app']);
    expect(importsOf('const m = await import(`../../../backend/src/app`);')).toEqual(['../../../backend/src/app']);
    expect(importsOf("export * from './a';\nexport { b } from './b';\nimport type { C } from './c';")).toEqual(['./a', './b', './c']);
    expect(importsOf("const fs = require('node:fs');")).toEqual(['node:fs']);
  });

  it('ignore un import en commentaire ou dans une chaîne', () => {
    expect(importsOf("// import { x } from '../../carte/src/x';\nexport const a = 1;")).toEqual([]);
    expect(importsOf(`const s = "import { x } from '../../carte/src/x'";`)).toEqual([]);
  });
});

describe('buildsRawHtml : construction de HTML brut', () => {
  it.each([
    '<div dangerouslySetInnerHTML={{ __html: x }} />',
    'el.innerHTML = x;',
    'el.outerHTML = x;',
    "el.insertAdjacentHTML('beforeend', x);",
    'document.write(x);',
    'range.createContextualFragment(x);',
    'el.setHTMLUnsafe(x);',
    '<iframe srcDoc={x} />',
  ])('refuse %s', (source) => expect(buildsRawHtml(source)).toBe(true));

  it('laisse passer le texte et textContent', () => {
    expect(buildsRawHtml('el.textContent = x; const html = "texte";')).toBe(false);
  });
});

describe('checkBoundaries : sur un petit dépôt de test', () => {
  const root = mkdtempSync(join(tmpdir(), 'frontieres-'));
  const put = (rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('accepte des imports permis', () => {
    put('frontend/admin/src/ok.tsx', "import { useState } from 'react';\nimport { api } from './api';\nexport const x = [useState, api];");
    put('frontend/carte/src/ok.ts', "import * as THREE from 'three';\nimport pois from '../content/pois.json';\nexport const y = [THREE, pois];");
    put('backend/src/ok.ts', "import { Hono } from 'hono';\nimport { readFileSync } from 'node:fs';\nexport const z = [Hono, readFileSync];");
    expect(checkBoundaries(root).errors).toEqual([]);
  });

  it('refuse le front qui importe le back, la carte qui importe React, le back qui importe le front, le HTML brut', () => {
    put('frontend/admin/src/ko.jsx', "import {\n  createApp, // l'API\n} from '../../../backend/src/app.js';\nexport const k = createApp;");
    put('frontend/carte/src/ko.ts', "import { useState } from 'react';\nexport const k = useState;");
    put('backend/src/ko.ts', "import { PALETTE } from '../../frontend/carte/src/scene/palette';\nexport const k = PALETTE;");
    put('frontend/admin/src/html.tsx', 'export const k = (el: HTMLElement) => { el.outerHTML = "<b>x</b>"; };');
    const { errors } = checkBoundaries(root);
    expect(errors).toHaveLength(4);
    expect(errors.join('\n')).toMatch(/frontend\/admin\/src\/ko\.jsx importe backend\/src\/app\.js : interdit \(admin → back\)/);
    expect(errors.join('\n')).toMatch(/frontend\/carte\/src\/ko\.ts importe le paquet « react »/);
    expect(errors.join('\n')).toMatch(/backend\/src\/ko\.ts importe frontend\/carte\/src\/scene\/palette : interdit \(back → carte\)/);
    expect(errors.join('\n')).toMatch(/frontend\/admin\/src\/html\.tsx construit du HTML brut/);
  });
});

describe('checkBoundaries : le vrai dépôt', () => {
  it('respecte ses frontières', () => {
    const { errors, checked } = checkBoundaries();
    expect(errors).toEqual([]);
    expect(checked).toBeGreaterThan(90);
  });
});
