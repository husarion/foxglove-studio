// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { produce } from "immer";
import * as _ from "lodash-es";
import { useMemo } from "react";

import { useShallowMemo } from "@foxglove/hooks";
import { SettingsTreeAction, SettingsTreeNodes } from "@foxglove/studio";

import { Config } from "./types";

export const defaultConfig: Config = {
  serviceName: "",
  statusTopicName: "",
  activationText: "Activate",
  activationColor: "#090",
  deactivationText: "Deactivate",
  deactivationColor: "#900",
};

function serviceError(serviceName?: string) {
  if (!serviceName) {
    return "Service cannot be empty";
  }
  return undefined;
}

export function settingsActionReducer(prevConfig: Config, action: SettingsTreeAction): Config {
  return produce(prevConfig, (draft) => {
    if (action.action === "update") {
      const { path, value } = action.payload;
      _.set(draft, path.slice(1), value);
    }
  });
}

const supportedDataTypes = ["bool"];

export function useSettingsTree(
  config: Config,
  pathParseError: string | undefined,
): SettingsTreeNodes {
  const settings = useMemo(
    (): SettingsTreeNodes => ({
      general: {
        fields: {
          serviceName: {
            label: "Service name",
            input: "string",
            error: serviceError(config.serviceName),
            value: config.serviceName,
          },
          statusTopicName: {
            label: "Current State Data",
            input: "messagepath",
            value: config.statusTopicName,
            error: pathParseError,
            validTypes: supportedDataTypes,
          },
          reverseLogic: {
            label: "Reverse state logic",
            input: "boolean",
            value: config.reverseLogic,
          },
        },
      },
      button: {
        label: "Button",
        fields: {
          activationText: {
            label: "Activation Message",
            input: "string",
            value: config.activationText,
            placeholder: "Activate",
          },
          activationColor: {
            label: "Activation Color",
            input: "rgb",
            value: config.activationColor,
          },
          deactivationText: {
            label: "Deactivation Message",
            input: "string",
            value: config.deactivationText,
            placeholder: "Deactivate",
          },
          deactivationColor: {
            label: "Deactivation Color",
            input: "rgb",
            value: config.deactivationColor,
          },
        },
      },
    }),
    [config],
  );
  return useShallowMemo(settings);
}
