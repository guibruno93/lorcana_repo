/**
 * Reexporta a app a partir de InkwellApp.jsx.
 *
 * Se o build falhar em App.jsx perto da linha 400+, o ficheiro foi substituído por
 * uma cópia antiga/mergeada. Apaga TODO o conteúdo deste ficheiro e deixa só as
 * duas linhas export abaixo (ou faz git checkout -- src/App.jsx após pull).
 */
export { default } from './InkwellApp';
export { api, apiFetch } from './InkwellApp';
