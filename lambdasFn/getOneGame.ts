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
    const parsedBody = JSON.parse(event.body!);
    const gameId = parsedBody.gameId as string;

    if (gameId === undefined) {
      throw Error("No `gameId` found");
    }

    const result: DynamoDB.GetItemOutput = await dynamoDb
      .getItem({
        TableName: "chessy_games",
        Key: { id: { S: gameId } },
      })
      .promise();

    let item: any = {};
    if (result.Item !== undefined) {
      item = DynamoDB.Converter.unmarshall(result.Item);
    }
    return {
      body: JSON.stringify({ game: item }),
      headers: DEFAULT_HEADERS,
      statusCode: 200,
    };
  } catch (e) {
    console.warn("Error:", e);
    return {
      body: "Server Error",
      statusCode: 400,
    };
  }
}
