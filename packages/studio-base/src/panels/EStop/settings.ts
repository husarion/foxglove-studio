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
  goServiceName: "",
  stopServiceName: "",
  statusTopicName: "",
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
          goServiceName: {
            label: "GO Service",
            input: "string",
            error: serviceError(config.goServiceName),
            value: config.goServiceName,
          },
          stopServiceName: {
            label: "STOP Service",
            input: "string",
            error: serviceError(config.stopServiceName),
            value: config.stopServiceName,
          },
          statusTopicName: {
            label: "EStop status topic",
            input: "messagepath",
            value: config.statusTopicName,
            error: pathParseError,
            validTypes: supportedDataTypes,
          },
        },
      },
    }),
    [config],
  );
  return useShallowMemo(settings);
}
