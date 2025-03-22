import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import { SpConfig } from "../app-config";
import { SpVpc } from "../network/vpc";
import { SpApi } from "../backend/api";
import { SpLetterAnalysisFunction } from "../backend/letter-analysis-function";

interface SpAuroraProps {
  spConfig: SpConfig;
  spVpc: SpVpc;
  spLetterAnalysisFunction: SpLetterAnalysisFunction;
  spApi: SpApi;
}

export class SpAurora extends Construct {
  auroraCluster: rds.DatabaseCluster;
  auroraSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SpAuroraProps) {
    super(scope, id);
    const spConfig = props.spConfig;
    const spVpc = props.spVpc;
    const spLetterAnalysisFunction = props.spLetterAnalysisFunction;
    const spApi = props.spApi;

    this.auroraSg = new ec2.SecurityGroup(this, "AuroraSecurityGroup", {
      vpc: spVpc.vpc,
    });
    this.auroraSg.addIngressRule(
      ec2.Peer.securityGroupId(
        spLetterAnalysisFunction.functionSg.securityGroupId,
      ),
      ec2.Port.allTraffic(),
    );
    this.auroraSg.addIngressRule(
      ec2.Peer.securityGroupId(spApi.functionSg.securityGroupId),
      ec2.Port.allTraffic(),
    );

    this.auroraCluster = new rds.DatabaseCluster(this, "AuroraCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        // ACUを0にできるバージョンを指定する
        version: rds.AuroraPostgresEngineVersion.VER_15_7,
      }),
      credentials: {
        username: spConfig.auroraUsername,
        secretName: spConfig.auroraSecretName,
      },
      // クエリエディタを使いたいのでDataApiをtrueにする
      enableDataApi: true,
      removalPolicy: RemovalPolicy.DESTROY,
      securityGroups: [this.auroraSg],
      serverlessV2MaxCapacity: 1,
      serverlessV2MinCapacity: 0,
      vpc: spVpc.vpc,
      vpcSubnets: { subnets: spVpc.privateSubnets },
      // instancePropsを設定しない場合はwriterが必須
      writer: rds.ClusterInstance.serverlessV2("writer"),
    });
  }
}
