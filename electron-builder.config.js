/** @type {import('electron-builder').Configuration} */
const [repoOwner = 'McFuzzySquirrel', repoName = 'repo-dungeon'] = (process.env.GITHUB_REPOSITORY ?? '')
  .split('/')
  .filter(Boolean);
const linuxMaintainer =
  process.env.ELECTRON_BUILDER_LINUX_MAINTAINER ?? 'Repo Dungeon Maintainers <maintainers@example.invalid>';

const config = {
  appId: 'com.repodungeon.app',
  productName: 'Repo Dungeon',
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  asar: true,
  compression: 'maximum',
  files: ['dist/**', 'dist-electron/**', 'package.json'],
  extraMetadata: {
    main: 'dist-electron/main.js',
  },
  mac: {
    category: 'public.app-category.games',
    hardenedRuntime: true,
    target: ['dmg', 'zip'],
  },
  win: {
    target: ['nsis', 'zip'],
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Game',
    maintainer: linuxMaintainer,
  },
  publish: [
    {
      provider: 'github',
      owner: repoOwner,
      repo: repoName,
    },
  ],
};

export default config;
