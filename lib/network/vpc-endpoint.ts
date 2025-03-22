import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { SpVpc } from "./vpc";

interface SpVpcEndpointProps {
  spVpc: SpVpc;
}

export class SpVpcEndpoint extends Construct {
  // Endpoint
  s3Gateway: ec2.GatewayVpcEndpoint;
  logs: ec2.InterfaceVpcEndpoint;
  secretsManager: ec2.InterfaceVpcEndpoint;
  ssm: ec2.InterfaceVpcEndpoint;
  bedrockRuntime: ec2.InterfaceVpcEndpoint;

  // Security Group
  logsSg: ec2.SecurityGroup;
  secretsManagerSg: ec2.SecurityGroup;
  ssmSg: ec2.SecurityGroup;
  bedrockRuntimeSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SpVpcEndpointProps) {
    super(scope, id);
    const spVpc = props.spVpc;

    // S3 Gateway Endpoint
    this.s3Gateway = spVpc.vpc.addGatewayEndpoint("S3Gateway", {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnets: spVpc.privateSubnets }],
    });
    this.s3Gateway.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // Cloudwatch Logs Endpoint
    this.logsSg = new ec2.SecurityGroup(this, "LogsSG", {
      vpc: spVpc.vpc,
    });

    this.logs = spVpc.vpc.addInterfaceEndpoint("Logs", {
      service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
      securityGroups: [this.logsSg],
      subnets: { subnets: spVpc.privateSubnets },
    });

    // SecretsManager Endpoint
    this.secretsManagerSg = new ec2.SecurityGroup(this, "SecretsManagerSG", {
      vpc: spVpc.vpc,
    });
    this.secretsManager = spVpc.vpc.addInterfaceEndpoint("SecretsManager", {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      securityGroups: [this.secretsManagerSg],
      subnets: { subnets: spVpc.privateSubnets },
    });

    // SystemsManager Endpoint
    this.ssmSg = new ec2.SecurityGroup(this, "SystemsManagerSG", {
      vpc: spVpc.vpc,
    });
    this.ssm = spVpc.vpc.addInterfaceEndpoint("SystemsManager", {
      service: ec2.InterfaceVpcEndpointAwsService.SSM,
      securityGroups: [this.ssmSg],
      subnets: { subnets: spVpc.privateSubnets },
    });

    // Bedrock Runtime Endpoint
    this.bedrockRuntimeSg = new ec2.SecurityGroup(this, "BedrockRuntimeSG", {
      vpc: spVpc.vpc,
    });
    this.bedrockRuntime = spVpc.vpc.addInterfaceEndpoint("BedrockRuntime", {
      service: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME,
      securityGroups: [this.bedrockRuntimeSg],
      subnets: { subnets: spVpc.privateSubnets },
    });
  }
}
