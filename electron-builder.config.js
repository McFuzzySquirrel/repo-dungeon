/** @type {import('electron-builder').Configuration} */
const config = {
  appId: 'com.repodungeon.app',
  productName: 'Repo Dungeon',
  directories: {
    app: '.',
    output: 'release',
    buildResources: 'build',
  },
  files: ['dist/**', 'dist-electron/**', 'package.json'],
  extraMetadata: {
    main: 'dist-electron/main.js',
  },
  mac: {
    category: 'public.app-category.games',
    target: ['dmg', 'zip'],
  },
  win: {
    target: ['nsis', 'zip'],
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Game',
  },
  publish: [
    {
      provider: 'github',
      owner: 'REPLACE_WITH_OWNER',
      repo: 'REPLACE_WITH_REPO',
    },
  ],
};

export default config;
