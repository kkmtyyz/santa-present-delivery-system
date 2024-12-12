import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { SpConfig } from "./app-config";

interface SpVpcProps {
  spConfig: SpConfig;
}

export class SpVpc extends Construct {
  vpc: ec2.Vpc;
  privateSubnets: ec2.ISubnet[];
  publicSubnets: ec2.ISubnet[];

  constructor(scope: Construct, id: string, props: SpVpcProps) {
    super(scope, id);
    const spConfig = props.spConfig;

    this.vpc = new ec2.Vpc(this, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr(spConfig.vpcCidr),
      subnetConfiguration: [
        {
          cidrMask: 20,
          name: `${spConfig.appName}-private`,
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 20,
          name: `${spConfig.appName}-public`,
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
      vpcName: `${spConfig.appName}-vpc`,
    });

    this.privateSubnets = this.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    }).subnets;
    this.publicSubnets = this.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PUBLIC,
    }).subnets;
  }
}
