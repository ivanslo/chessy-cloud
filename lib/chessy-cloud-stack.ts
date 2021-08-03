import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as sqs from "@aws-cdk/aws-sqs";
import * as lambda from "@aws-cdk/aws-lambda";
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as iam from "@aws-cdk/aws-iam";
import * as lambdaEventSource from "@aws-cdk/aws-lambda-event-sources";

import { BlockPublicAccess } from "@aws-cdk/aws-s3";
import { Duration, RemovalPolicy } from "@aws-cdk/core";
import { AttributeType, BillingMode } from "@aws-cdk/aws-dynamodb";
import { Code, Runtime } from "@aws-cdk/aws-lambda";

export class ChessyCloudStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, { ...props });

    /* S3 Bucket
    --------------------*/
    // const s3LambdaFunctions = new s3.Bucket(this, "chessy-lambda-functions", {
    //   bucketName: "chessy-lambda-functions",
    //   blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    //   removalPolicy: RemovalPolicy.DESTROY
    // });

    const s3LambdaFunctions = s3.Bucket.fromBucketArn(
      this,
      "chessy-lambda-functions",
      "arn:aws:s3:::chessy-lambda-functions"
    );

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

    const dynamoDbTables = []
    for (const table of tables) {
      const t = new dynamodb.Table(this, table, {
        tableName: table,
        partitionKey: { name: "id", type: AttributeType.STRING },
        billingMode: BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.DESTROY,
      });
      dynamoDbTables.push(t)
    }

    /* SQS Queues
    --------------------*/
    const deadLetterQueue = new sqs.Queue(this, "chessy-pgn-games-failed-dlq", {
      queueName: "chessy-pgn-games-failed-dlq",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const gamesToProcessQueue = new sqs.Queue(this, "chessy-pgn-games-to-process", {
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
    const lambdaSplitter = new lambda.Function(this, "chessy-splitter", {
      functionName: "chessy-splitter",
      description:
        "Split big PGN files into chunks with a fixed amount of games",
      runtime: Runtime.PYTHON_3_8,
      memorySize: 128,
      timeout: Duration.seconds(13),
      handler: "lambda_ChessyPGNSplitter.lambda_handler",
      code: Code.fromBucket(s3LambdaFunctions, "lambdaSplitter.zip"),
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY,
      },
      environment: {
        LOG_LEVEL: "3",
        SQS_URL: gamesToProcessQueue.queueUrl
      },
    });
    const lambdaParser = new lambda.Function(this, "chessy-parser-partial", {
      functionName: "chessy-parser-partial",
      description: "Process a chunk of a PGN file",
      runtime: Runtime.PYTHON_3_8,
      memorySize: 128,
      timeout: Duration.seconds(30),
      handler: "lambda_ChessyPGNParserPartial.lambda_handler",
      code: Code.fromBucket(s3LambdaFunctions, "lambdaParserPartial.zip"),
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY,
      },
      environment: {
        LOG_LEVEL: "3",
        TABLE_CHESS_GAMES: "chessy_games",
        TABLE_CHESS_GAMES_FAILED: "chessy_games_failed",
        TABLE_PGN_FILES_FAILED: "chessy_pgn_files_failed",
        TABLE_PGN_FILES_SUCCEEDED: "chessy_pgn_files_succeeded"
      },
    });
    const lambdaFailer = new lambda.Function(this, "chessy-failer", {
      functionName: "chessy-failer",
      description:
        "Process the messages in the DLQ, consuming them while recording them in the DB",
      runtime: Runtime.PYTHON_3_8,
      memorySize: 128,
      timeout: Duration.seconds(8),
      handler: "lambda_ChessyPGNFailedProcess.lambda_handler",
      code: Code.fromBucket(s3LambdaFunctions, "lambdaFailer.zip"),
      currentVersionOptions: {
        removalPolicy: RemovalPolicy.DESTROY,
      },
      environment: {
        LOG_LEVEL: "3",
        TABLE_PGN_FILES_FAILED: "chessy_pgn_files_failed",
        //TODO: do the same, pass the table names 
      },
    });

    /* API Gateway
    --------------------*/
    const apiGtwRest = new apigateway.RestApi(this, "chessy-rest", {
      restApiName: "chessy-rest",
      description: "Manage data for chessy project",
      deploy: true,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const getPolicy = new iam.Policy(this, "getlistPolicy", {
      statements: [
        new iam.PolicyStatement({
          actions: ["dynamodb:GetItem", "dynamodb:Scan", "dynamodb:Query"],
          effect: iam.Effect.ALLOW,
          resources: [
            "arn:aws:dynamodb:eu-west-2:515610816793:table/chess_games",
          ],
        }),
      ],
    });

    const getRole = new iam.Role(this, "getRole", {
      assumedBy: new iam.ServicePrincipal("apigateway.amazonaws.com"),
    });
    getRole.attachInlinePolicy(getPolicy);

    // GETLIST

    const integrationResponsesArray = [
      { statusCode: "200" },
      {
        selectionPattern: "400",
        statusCode: "400",
        responseTemplates: {
          "application/json": `{
            "error": "Bad input!"
          }`,
        },
      },
      {
        selectionPattern: "5\\d{2}",
        statusCode: "500",
        responseTemplates: {
          "application/json": `{
            "error": "Internal Service Error!"
          }`,
        },
      },
    ];
    const methodOptions = {
      methodResponses: [
        { statusCode: "200" },
        { statusCode: "400" },
        { statusCode: "500" },
      ],
    };

    const dynamodbintegration = new apigateway.AwsIntegration({
      action: "Scan",
      region: "eu-west-2",
      service: "dynamodb",
      options: {
        credentialsRole: getRole,
        integrationResponses: integrationResponsesArray,
        requestTemplates: {
          "application/json": `{
              "TableName": "chess_games",
              "ProjectionExpression": "id, Black, White, Event, #r",
              "ExpressionAttributeNames":{"#r": "Result"}
          }`,
        },
      },
    });
    const resource = apiGtwRest.root.addResource("getallgames_");
    resource.addMethod("POST", dynamodbintegration, methodOptions);

    // GETGAME
    const dynamodbintegrationGG = new apigateway.AwsIntegration({
      action: "GetItem",
      region: "eu-west-2",
      service: "dynamodb",
      options: {
        credentialsRole: getRole,
        integrationResponses: integrationResponsesArray,
        requestTemplates: {
          "application/json": `{
            "TableName": "chess_games",
            "Key": { "id":{"S": "$input.path('$.gameId')"}}
          }`,
        },
      },
    });
    const resourceGG = apiGtwRest.root.addResource("getgame_");
    resourceGG.addMethod("POST", dynamodbintegrationGG, methodOptions);

    /* CONNECTIONS */
    // 1. trigger lambda 'splitter' when s3 gets the object
    // 2. pass the name of the queue to 'splitter' to output the messages
    s3PGNFiles.grantRead(lambdaSplitter);

    const s3PGNFilesEventSource = new lambdaEventSource.S3EventSource(s3PGNFiles, {
      events: [
        s3.EventType.OBJECT_CREATED
      ]
    })
    lambdaSplitter.addEventSource(s3PGNFilesEventSource);
    gamesToProcessQueue.grantSendMessages(lambdaSplitter);

    // 3. trigger lambda 'parser partial' when messages in the queue
    //    pass tablenames to 'parser partial'

    s3PGNFiles.grantRead(lambdaParser);
    gamesToProcessQueue.grantConsumeMessages(lambdaParser);
    const sqsPGNGamesEventSource = new lambdaEventSource.SqsEventSource(gamesToProcessQueue, {
      batchSize: 1
    });
    lambdaParser.addEventSource(sqsPGNGamesEventSource)

    for( const table of dynamoDbTables) {
      table.grantWriteData(lambdaParser)
    }

    // 4. trigger lambda 'failed-pgn-games' when dlq gets messages
    //    pass tablenames to this lambda
    deadLetterQueue.grantConsumeMessages(lambdaFailer);
    const sqsDLQEventSource = new lambdaEventSource.SqsEventSource(deadLetterQueue);
    lambdaFailer.addEventSource(sqsDLQEventSource);

    (dynamoDbTables[3] as dynamodb.Table).grantWriteData(lambdaFailer);

  }
}
