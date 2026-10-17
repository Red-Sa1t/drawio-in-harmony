import { hapTasks } from '@ohos/hvigor-ohos-plugin';
import { electronHnp } from '../hvigor/electron-hnp';

export default {
    system: hapTasks,  /* Built-in plugin of Hvigor. It cannot be modified. */
    plugins:[electronHnp]
}
