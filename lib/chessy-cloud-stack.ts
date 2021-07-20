import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as dynamodb from "@aws-cdk/aws-dynamodb";

import { BlockPublicAccess } from "@aws-cdk/aws-s3";
import { RemovalPolicy } from "@aws-cdk/core";
import { AttributeType, BillingMode } from "@aws-cdk/aws-dynamodb";

export class ChessyCloudStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, { ...props });

    /* S3 Bucket
    --------------------*/
    new s3.Bucket(this, "chessy-pgn-files", {
      bucketName: "chessy-pgn-files",
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /* dynamodb tables
    --------------------*/
    const tables = [
      "chessy_games",
      "chessy_games_failed",
      "chessy_games_succeeded",
      "chessy_pgn_files_failed",
      "chessy_pgn_files_succeeded",
    ];

    for (const table of tables) {
      new dynamodb.Table(this, table, {
        tableName: table,
        partitionKey: { name: "id", type: AttributeType.STRING },
        billingMode: BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
      });
    }
  }
}
