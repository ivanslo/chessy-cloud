import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as ChessyCloud from '../lib/chessy-cloud-stack';

test("Empty Stack", () => {
    const app = new cdk.App();
    const stack = new ChessyCloud.ChessyCloudStack(app, 'MyTestStack');
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});

test("Where we're going we don't need tests", () => {
  expect(1).toEqual(1);
})