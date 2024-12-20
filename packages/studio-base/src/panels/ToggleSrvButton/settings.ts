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
  initialValue: false,
  requestPayload: `{"data": true}`,
  buttonActive: "Activate",
  buttonDisable: "Deactivate",
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

export function useSettingsTree(config: Config): SettingsTreeNodes {
  const settings = useMemo(
    (): SettingsTreeNodes => ({
      general: {
        fields: {
          serviceName: {
            label: "Service name",
            input: "string",
            error: serviceError(config.serviceName),
            value: config.serviceName ?? "",
          },
        },
      },
      button: {
        label: "Button",
        fields: {
          initialValue: {
            label: "Initial State",
            input: "boolean",
            value: config.initialValue,
          },
          buttonActive: {
            label: "Activation Message",
            input: "string",
            value: config.buttonActive,
            placeholder: "Activate",
          },
          buttonDisable: {
            label: "Deactivation Message",
            input: "string",
            value: config.buttonDisable,
            placeholder: "Deactivate",
          },
          buttonTooltip: { label: "Tooltip", input: "string", value: config.buttonTooltip },
        },
      },
    }),
    [config],
  );
  return useShallowMemo(settings);
}
