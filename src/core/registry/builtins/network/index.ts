import apiGatewayYaml from './api-gateway.yaml?raw';
import loadBalancerYaml from './load-balancer.yaml?raw';
import cdnYaml from './cdn.yaml?raw';

export const networkYamls = [apiGatewayYaml, loadBalancerYaml, cdnYaml];
