// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { expect } from "@storybook/jest";
import { StoryContext, StoryFn, StoryObj } from "@storybook/react";
import { userEvent, within } from "@storybook/testing-library";

import { PlayerCapabilities } from "@foxglove/studio-base/players/types";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import delay from "@foxglove/studio-base/util/delay";

import EStopPanel from "./index";
import { Config } from "./types";

const successResponseJson = JSON.stringify({ success: true }, undefined, 2);
const baseConfig: Config = {
  goServiceName: "/trigger",
  stopServiceName: "/reset",
  statusTopicName: "/status",
};

const getFixture = ({ allowCallService }: { allowCallService: boolean }): Fixture => {
  const callService = async (service: string, _request: unknown) => {
    if (service !== baseConfig.goServiceName) {
      throw new Error(`Service "${service}" does not exist`);
    }

    return { success: true };
  };

  return {
    datatypes: new Map(
      Object.entries({
        "std_srvs/SetBool_Request": { definitions: [{ name: "data", type: "bool" }] },
      }),
    ),
    frame: {},
    capabilities: allowCallService ? [PlayerCapabilities.callServices] : [],
    callService,
  };
};

export default {
  title: "panels/EStop",
  component: EStopPanel,
  parameters: {
    colorScheme: "both-column",
  },
  decorators: [
    (StoryComponent: StoryFn, { parameters }: StoryContext): JSX.Element => {
      return (
        <PanelSetup fixture={parameters.panelSetup?.fixture}>
          <StoryComponent />
        </PanelSetup>
      );
    },
  ],
};

export const Default: StoryObj = {
  render: () => {
    return <EStopPanel />;
  },
};

export const EStopEnabled: StoryObj = {
  render: () => {
    return <EStopPanel />;
  },

  parameters: { panelSetup: { fixture: getFixture({ allowCallService: true }) } },
};

export const EStopEnabledServiceName: StoryObj = {
  render: () => {
    return <EStopPanel overrideConfig={{ ...baseConfig }} />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const responseTextareas = await canvas.findAllByPlaceholderText("Response");
    const buttons = await canvas.findAllByTestId("call-service-button");
    buttons.forEach(async (button) => {
      await userEvent.click(button);
    });
    await delay(500);
    for (const textarea of responseTextareas) {
      await expect(textarea).toHaveValue(successResponseJson);
    }
  },

  parameters: { panelSetup: { fixture: getFixture({ allowCallService: true }) } },
};

export const EStopEnabledWithCustomButtonSettings: StoryObj = {
  render: () => {
    return (
      <EStopPanel
        overrideConfig={{ ...baseConfig }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const buttons = await canvas.findAllByText("Call that funky service");
    buttons.forEach(async (button) => {
      await userEvent.hover(button);
    });
  },

  parameters: { panelSetup: { fixture: getFixture({ allowCallService: true }) } },
};

export const CallingServiceThatDoesNotExist: StoryObj = {
  render: () => {
    return (
      <EStopPanel
        overrideConfig={{
          ...baseConfig,
          serviceName: "/non_existing_service",
        }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const responseTextareas = await canvas.findAllByPlaceholderText("Response");
    const buttons = await canvas.findAllByTestId("call-service-button");
    buttons.forEach(async (button) => {
      await userEvent.click(button);
    });
    await delay(500);
    for (const textarea of responseTextareas) {
      await expect(textarea).toHaveValue(`Service "/non_existing_service" does not exist`);
    }
  },

  parameters: { panelSetup: { fixture: getFixture({ allowCallService: true }) } },
};
