// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { DeepPartial } from "ts-essentials";

import { ros1 } from "@foxglove/rosmsg-msgs-common";
import {
  PanelExtensionContext,
  SettingsTreeAction,
  SettingsTreeNode,
  SettingsTreeNodes,
  Topic,
} from "@foxglove/studio";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Stack from "@foxglove/studio-base/components/Stack";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import DirectionalPad, { DirectionalPadAction } from "./DirectionalPad";

type TeleopPanelProps = {
  context: PanelExtensionContext;
};

const geometryMsgOptions = [
  { label: "linear-x", value: "linear-x" },
  { label: "linear-y", value: "linear-y" },
  { label: "linear-z", value: "linear-z" },
  { label: "angular-x", value: "angular-x" },
  { label: "angular-y", value: "angular-y" },
  { label: "angular-z", value: "angular-z" },
];

type Config = {
  topic: undefined | string;
  publishRate: number;
  stamped: boolean;
  upButton: { field: string; value: number };
  downButton: { field: string; value: number };
  leftButton: { field: string; value: number };
  rightButton: { field: string; value: number };
};

function buildSettingsTree(config: Config, topics: readonly Topic[]): SettingsTreeNodes {
  const general: SettingsTreeNode = {
    label: "General",
    fields: {
      publishRate: { label: "Publish rate", input: "number", value: config.publishRate },
      topic: {
        label: "Topic",
        input: "autocomplete",
        value: config.topic,
        items: topics.map((t) => t.name),
      },
      stamped: {
        label: "Stamped",
        input: "boolean",
        value: config.stamped,
      },
    },
    children: {
      upButton: {
        label: "Up Button",
        fields: {
          field: {
            label: "Field",
            input: "select",
            value: config.upButton.field,
            options: geometryMsgOptions,
          },
          value: { label: "Value", input: "number", value: config.upButton.value },
        },
      },
      downButton: {
        label: "Down Button",
        fields: {
          field: {
            label: "Field",
            input: "select",
            value: config.downButton.field,
            options: geometryMsgOptions,
          },
          value: { label: "Value", input: "number", value: config.downButton.value },
        },
      },
      leftButton: {
        label: "Left Button",
        fields: {
          field: {
            label: "Field",
            input: "select",
            value: config.leftButton.field,
            options: geometryMsgOptions,
          },
          value: { label: "Value", input: "number", value: config.leftButton.value },
        },
      },
      rightButton: {
        label: "Right Button",
        fields: {
          field: {
            label: "Field",
            input: "select",
            value: config.rightButton.field,
            options: geometryMsgOptions,
          },
          value: { label: "Value", input: "number", value: config.rightButton.value },
        },
      },
    },
  };

  return { general };
}

function TeleopPanel(props: TeleopPanelProps): JSX.Element {
  const { context } = props;
  const { saveState } = context;

  const [currentAction, setCurrentAction] = useState<DirectionalPadAction | undefined>();
  const [topics, setTopics] = useState<readonly Topic[]>([]);

  // resolve an initial config which may have some missing fields into a full config
  const [config, setConfig] = useState<Config>(() => {
    const partialConfig = context.initialState as DeepPartial<Config>;

    const {
      topic,
      publishRate = 5,
      stamped = false,
      upButton: { field: upField = "linear-x", value: upValue = 1 } = {},
      downButton: { field: downField = "linear-x", value: downValue = -1 } = {},
      leftButton: { field: leftField = "angular-z", value: leftValue = 1 } = {},
      rightButton: { field: rightField = "angular-z", value: rightValue = -1 } = {},
    } = partialConfig;

    return {
      topic,
      publishRate,
      stamped,
      upButton: { field: upField, value: upValue },
      downButton: { field: downField, value: downValue },
      leftButton: { field: leftField, value: leftValue },
      rightButton: { field: rightField, value: rightValue },
    };
  });

  const settingsActionHandler = useCallback((action: SettingsTreeAction) => {
    if (action.action !== "update") {
      return;
    }

    setConfig((previous) => {
      const newConfig = { ...previous };
      _.set(newConfig, action.payload.path.slice(1), action.payload.value);
      return newConfig;
    });
  }, []);

  // setup context render handler and render done handling
  const [renderDone, setRenderDone] = useState<() => void>(() => () => { });
  const [colorScheme, setColorScheme] = useState<"dark" | "light">("light");
  useLayoutEffect(() => {
    context.watch("topics");
    context.watch("colorScheme");

    context.onRender = (renderState, done) => {
      setTopics(renderState.topics ?? []);
      setRenderDone(() => done);
      if (renderState.colorScheme) {
        setColorScheme(renderState.colorScheme);
      }
    };
  }, [context]);

  useEffect(() => {
    const tree = buildSettingsTree(config, topics);
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: tree,
    });
    saveState(config);
  }, [config, context, saveState, settingsActionHandler, topics]);

  // advertise topic
  const { topic: currentTopic, stamped } = config;
  useLayoutEffect(() => {
    if (!currentTopic) {
      return;
    }

    const messageType = stamped ? "geometry_msgs/TwistStamped" : "geometry_msgs/Twist";
    const datatypesMap = stamped
      ? new Map([
        ["std_msgs/Header", ros1["std_msgs/Header"]],
        ["geometry_msgs/Vector3", ros1["geometry_msgs/Vector3"]],
        ["geometry_msgs/Twist", ros1["geometry_msgs/Twist"]],
        ["geometry_msgs/TwistStamped", ros1["geometry_msgs/TwistStamped"]],
      ])
      : new Map([
        ["geometry_msgs/Vector3", ros1["geometry_msgs/Vector3"]],
        ["geometry_msgs/Twist", ros1["geometry_msgs/Twist"]],
      ]);

    context.advertise?.(currentTopic, messageType, { datatypes: datatypesMap });

    return () => {
      context.unadvertise?.(currentTopic);
    };
  }, [context, currentTopic, stamped]);

  const getRosTimestamp = () => {
    const now = Date.now();
    return {
      sec: Math.floor(now / 1000),
      nanosec: (now % 1000) * 1e6,
    };
  };

  const createMessage = () => {
    return {
      header: {
        stamp: getRosTimestamp(),
        frame_id: "base_link",
      },
      twist: {
        linear: { x: 0, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: 0 },
      },
    };
  };

  function setFieldValue(message: any, field: string, value: number) {
    switch (field) {
      case "linear-x":
        message.twist.linear.x = value;
        break;
      case "linear-y":
        message.twist.linear.y = value;
        break;
      case "linear-z":
        message.twist.linear.z = value;
        break;
      case "angular-x":
        message.twist.angular.x = value;
        break;
      case "angular-y":
        message.twist.angular.y = value;
        break;
      case "angular-z":
        message.twist.angular.z = value;
        break;
    }
  }

  useLayoutEffect(() => {
    if (currentAction == undefined || !currentTopic) {
      return;
    }

    const publishMessage = () => {
      const message = createMessage();

      switch (currentAction) {
        case DirectionalPadAction.UP:
          setFieldValue(message, config.upButton.field, config.upButton.value);
          break;
        case DirectionalPadAction.DOWN:
          setFieldValue(message, config.downButton.field, config.downButton.value);
          break;
        case DirectionalPadAction.LEFT:
          setFieldValue(message, config.leftButton.field, config.leftButton.value);
          break;
        case DirectionalPadAction.RIGHT:
          setFieldValue(message, config.rightButton.field, config.rightButton.value);
          break;
        default:
      }
      const messageToSend = config.stamped ? message : message.twist;
      context.publish?.(currentTopic, messageToSend);
    };

    // don't publish if rate is 0 or negative - this is a config error on user's part
    if (config.publishRate > 0) {
      const intervalMs = (1000 * 1) / config.publishRate;
      publishMessage();
      const intervalHandle = setInterval(publishMessage, intervalMs);
      return () => {
        clearInterval(intervalHandle);
      };
    } else {
      return;
    }
  }, [context, config, currentTopic, currentAction]);

  useLayoutEffect(() => {
    renderDone();
  }, [renderDone]);

  const canPublish = context.publish != undefined && config.publishRate > 0;
  const hasTopic = Boolean(currentTopic);
  const enabled = canPublish && hasTopic;

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <Stack
        fullHeight
        justifyContent="center"
        alignItems="center"
        style={{ padding: "min(5%, 8px)", textAlign: "center" }}
      >
        {!canPublish && <EmptyState>Connect to a data source that supports publishing</EmptyState>}
        {canPublish && !hasTopic && (
          <EmptyState>Select a publish topic in the panel settings</EmptyState>
        )}
        {enabled && <DirectionalPad onAction={setCurrentAction} disabled={!enabled} />}
      </Stack>
    </ThemeProvider>
  );
}

export default TeleopPanel;
