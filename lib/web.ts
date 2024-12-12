import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3Deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { SpConfig } from "./app-config";

interface SpWebProps {
  spConfig: SpConfig;
}

export class SpWeb extends Construct {
  webContentsBucket: s3.Bucket;
  webDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: SpWebProps) {
    super(scope, id);
    const spConfig = props.spConfig;

    // webサイトホスティング用バケット
    this.webContentsBucket = new s3.Bucket(this, "WebContentsBucket", {
      bucketName: `${spConfig.appName}-web`,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      websiteIndexDocument: "index.html",
    });

    new s3Deploy.BucketDeployment(this, "WebContentsDeploy", {
      sources: [s3Deploy.Source.asset("resources/web")],
      destinationBucket: this.webContentsBucket,
    });

    // cloudfront
    this.webDistribution = new cloudfront.Distribution(
      this,
      "WebDistribution",
      {
        defaultBehavior: {
          origin: new origins.S3StaticWebsiteOrigin(this.webContentsBucket),
        },
      },
    );
  }
}
