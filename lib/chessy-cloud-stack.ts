import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import { BlockPublicAccess } from "@aws-cdk/aws-s3";
import { RemovalPolicy } from "@aws-cdk/core";

export class ChessyCloudStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, { ...props} );

    new s3.Bucket(this, "chessy-pgn-files", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY
    });
    // The code that defines your stack goes here
  }
}
