import serviceYaml from './service.yaml?raw';
import functionYaml from './function.yaml?raw';
import workerYaml from './worker.yaml?raw';
import containerYaml from './container.yaml?raw';
import cronJobYaml from './cron-job.yaml?raw';

export const computeYamls = [serviceYaml, functionYaml, workerYaml, containerYaml, cronJobYaml];
