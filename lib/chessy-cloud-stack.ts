import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as sqs from "@aws-cdk/aws-sqs";
import * as lambda from "@aws-cdk/aws-lambda";

import { BlockPublicAccess } from "@aws-cdk/aws-s3";
import { RemovalPolicy } from "@aws-cdk/core";
import { AttributeType, BillingMode } from "@aws-cdk/aws-dynamodb";
import { Duration } from "@aws-cdk/aws-dynamodb/node_modules/@aws-cdk/core";
import { Code, Runtime } from "@aws-cdk/aws-lambda";

export class ChessyCloudStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, { ...props });

    /* S3 Bucket
    --------------------*/
    const s3LambdaFunctions = new s3.Bucket(this, "chessy-lambda-functions", {
      bucketName: "chessy-lambda-functions",
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const s3PGNFiles = new s3.Bucket(this, "chessy-pgn-files", {
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

    /* SQS Queues
    --------------------*/
    const deadLetterQueue = new sqs.Queue(this, "chessy-pgn-games-failed-dlq", {
      queueName: "chessy-pgn-games-failed-dlq",

      removalPolicy: RemovalPolicy.DESTROY,
    });

    new sqs.Queue(this, "chessy-pgn-games-to-process", {
      queueName: "chessy-pgn-games-to-process",
      visibilityTimeout: Duration.minutes(2),
      deadLetterQueue: {
        maxReceiveCount: 2,
        queue: deadLetterQueue,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /* Lambda Functions
    --------------------*/
    new lambda.Function(this, "chessy-splitter", {
      functionName: "chessy-splitter",
      description: "Split big PGN files into chunks with a fixed amount of games",
      runtime: Runtime.PYTHON_3_8,
      memorySize: 128,
      timeout: Duration.seconds(13),
      handler: 'lambda_ChessyPGNSplitter.lambda_handler',
      code: Code.fromBucket(s3LambdaFunctions, 'lambdaSplitter.zip'),
      currentVersionOptions:{
        removalPolicy: RemovalPolicy.DESTROY
      },
      environment: {
        "LOG_LEVEL": "3",
        // TODO: add the sqs I just created
        "SQS_URL": "https://sqs.eu-west-2.amazonaws.com/515610816793/PGNGamesToProcessQueue"
      }
    })
    new lambda.Function(this, "chessy-parser-partial", {
      functionName: "chessy-parser-partial",
      description: "Process a chunk of a PGN file",
      runtime: Runtime.PYTHON_3_8,
      memorySize: 128,
      timeout: Duration.seconds(30),
      handler: 'lambda_ChessyPGNParserPartial.lambda_handler',
      code: Code.fromBucket(s3LambdaFunctions, 'lambdaParserPartial.zip'),
      currentVersionOptions:{
        removalPolicy: RemovalPolicy.DESTROY
      },
      environment: {
        "LOG_LEVEL": "3",
      }
    });
    new lambda.Function(this, "chessy-failer", {
      functionName: "chessy-failer",
      description: "Process the messages in the DLQ, consuming them while recording them in the DB",
      runtime: Runtime.PYTHON_3_8,
      memorySize: 128,
      timeout: Duration.seconds(8),
      handler: 'lambda_ChessyPGNFailedProcess.lambda_handler',
      code: Code.fromBucket(s3LambdaFunctions, 'lambdaFailer.zip'),
      currentVersionOptions:{
        removalPolicy: RemovalPolicy.DESTROY
      },
      environment: {
        "LOG_LEVEL": "3",
      }
    });

  }
}
