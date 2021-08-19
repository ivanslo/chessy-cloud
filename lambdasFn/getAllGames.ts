import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDB } from "aws-sdk";
import { DEFAULT_HEADERS } from "./Constants";

export async function main(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const dynamoDb = new DynamoDB({
    region: "eu-west-2",
  });
  try {
    const result: DynamoDB.ScanOutput = await dynamoDb
      .scan({
        TableName: "chessy_games",
        ProjectionExpression: "id, White, Black, Event, #r",
        ExpressionAttributeNames: { "#r": "Result" },
      })
      .promise();

    let items: any[] = [];
    if (result.Items !== undefined) {
      items = result.Items.map((i: DynamoDB.AttributeMap) =>
        DynamoDB.Converter.unmarshall(i)
      );
    }

    // TODO: also return `result.LastEvaluatedKey` to allow pagination
    return {
      body: JSON.stringify({ games: items }),
      headers: DEFAULT_HEADERS,
      statusCode: 200,
    };
  } catch (e) {
    return {
      body: "Server Error",
      statusCode: 400,
    };
  }
}
