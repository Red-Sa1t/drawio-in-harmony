import { HvigorNode, HvigorPlugin } from '@ohos/hvigor';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Hvigor 6.24.4 omits --hnp-path. Repack using the SDK's supported option
// after PackageHap and before either packing checks or signing consume it.
export const electronHnp: HvigorPlugin = {
  pluginId: 'drawio-electron-hnp',
  apply(node: HvigorNode): void {
    const moduleRoot = node.getNodeDir().filePath;
    const migrationRoot = path.resolve(moduleRoot, '../../..');
    node.registerTask({
      name: 'default@PackElectronHnp',
      dependencies: ['default@PackageHap'],
      postDependencies: ['default@PackingCheck', 'default@SignHap'],
      run(): void {
        const sdk = process.env.DEVECO_SDK_HOME;
        if (!sdk) throw new Error('DEVECO_SDK_HOME must be supplied by the build launcher');
        const result = spawnSync(process.execPath, [path.join(migrationRoot, 'scripts/pack-probe-hnp.mjs'),
          '--studio', path.dirname(sdk), '--output',
          path.join(moduleRoot, 'build/default/outputs/default/electron-default-unsigned.hap')],
        { encoding: 'utf8', windowsHide: true });
        if (result.status !== 0 || result.error) {
          throw new Error(`Electron HNP packaging failed: ${result.error || result.stderr || result.stdout}`);
        }
        console.log(result.stdout);
      }
    });
  }
};
