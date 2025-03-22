import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { SpConfig } from "./app-config";
import { SpVpc } from "./network/vpc";
import { SpVpcEndpoint } from "./network/vpc-endpoint";
import { SpLambdaLayer } from "./backend/lambda-layer";
import { SpLetterAnalysisFunction } from "./backend/letter-analysis-function";
import { SpWeb } from "./frontend/web";
import { SpApi } from "./backend/api";
import { SpAurora } from "./db/aurora";

export class SantaPresentDeliverySystemStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const spConfig = new SpConfig();
    const spVpc = new SpVpc(this, "SpVpc", { spConfig });
    const spVpcEndpoint = new SpVpcEndpoint(this, "SpVpcEndpoint", {
      spVpc,
    });
    const spLambdaLayer = new SpLambdaLayer(this, "SpLambdalayer");
    const spLetterAnalysisFunction = new SpLetterAnalysisFunction(
      this,
      "SpLetterAnalysisFunction",
      { spConfig, spVpc, spLambdaLayer },
    );
    const spWeb = new SpWeb(this, "SpWeb", { spConfig });
    const spApi = new SpApi(this, "SpApi", {
      spConfig,
      spVpc,
      spLambdaLayer,
      spWeb,
    });
    const spAurora = new SpAurora(this, "SpAurora", {
      spConfig,
      spVpc,
      spLetterAnalysisFunction,
      spApi,
    });

    new cdk.CfnOutput(this, "LetterBucketName", {
      value: spLetterAnalysisFunction.letterBucket.bucketName,
    });

    new cdk.CfnOutput(this, "webBucketName", {
      value: spWeb.webContentsBucket.bucketName,
    });

    new cdk.CfnOutput(this, "WebUrl", {
      value: `https://${spWeb.webDistribution.distributionDomainName}`,
    });

    new cdk.CfnOutput(this, "ApiUrl", {
      value: spApi.apiUrl,
    });
  }
}
