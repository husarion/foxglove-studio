// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { DeepPartial } from "ts-essentials";

import { ros2humble } from "@foxglove/rosmsg-msgs-common";
import {
  PanelExtensionContext,
  SettingsTreeAction,
  SettingsTreeNode,
  SettingsTreeNodes,
  Topic,
} from "@foxglove/studio";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import JoyVisual from "./JoyVisual";

type JoyProps = {
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

type Axis = { field: string; limit: number };

type Config = {
  topic: undefined | string;
  publishRate: number;
  stamped: boolean;
  advanced: boolean;
  xAxis: Axis;
  yAxis: Axis;
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
      advanced: {
        label: "Advanced view",
        input: "boolean",
        value: config.advanced,
      },
    },
    children: {
      xAxis: {
        label: "X Axis",
        fields: {
          field: {
            label: "Field",
            input: "select",
            value: config.xAxis.field,
            options: geometryMsgOptions,
          },
          limit: {
            label: "Limit",
            input: "number",
            value: config.xAxis.limit,
            step: 0.25,
            min: 0,
            max: 10,
          },
        },
      },
      yAxis: {
        label: "Y Axis",
        fields: {
          field: {
            label: "Field",
            input: "select",
            value: config.yAxis.field,
            options: geometryMsgOptions,
          },
          limit: {
            label: "Limit",
            input: "number",
            value: config.yAxis.limit,
            step: 0.25,
            min: 0,
            max: 10,
          },
        },
      },
    },
  };

  return { general };
}

function Joy(props: JoyProps): JSX.Element {
  const { context } = props;
  const { saveState } = context;

  const [speed, setVelocity] = useState<{ x: number; y: number } | undefined>();
  const [topics, setTopics] = useState<readonly Topic[]>([]);

  // Resolve an initial config which may have some missing fields into a full config
  const [config, setConfig] = useState<Config>(() => {
    const partialConfig = context.initialState as DeepPartial<Config>;

    const {
      topic,
      publishRate = 5,
      stamped = false,
      advanced = false,
      xAxis: { field: xAxisField = "linear-x", limit: xLimit = 1 } = {},
      yAxis: { field: yAxisField = "angular-z", limit: yLimit = 1 } = {},
    } = partialConfig;

    return {
      topic,
      publishRate,
      stamped,
      advanced,
      xAxis: { field: xAxisField, limit: xLimit },
      yAxis: { field: yAxisField, limit: yLimit },
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

  // Setup context render handler and render done handling
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

  // Advertise topic
  const { topic: currentTopic, stamped } = config;
  useLayoutEffect(() => {
    if (!currentTopic) {
      return;
    }

    const messageType = stamped ? "geometry_msgs/TwistStamped" : "geometry_msgs/Twist";
    const datatypesMap = stamped
      ? new Map([
        ["std_msgs/Header", ros2humble["std_msgs/Header"]],
        ["geometry_msgs/Vector3", ros2humble["geometry_msgs/Vector3"]],
        ["geometry_msgs/Twist", ros2humble["geometry_msgs/Twist"]],
        ["geometry_msgs/TwistStamped", ros2humble["geometry_msgs/TwistStamped"]],
      ])
      : new Map([
        ["geometry_msgs/Vector3", ros2humble["geometry_msgs/Vector3"]],
        ["geometry_msgs/Twist", ros2humble["geometry_msgs/Twist"]],
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
    if (config.stamped) {
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
    } else {
      return {
        linear: { x: 0, y: 0, z: 0 },
        angular: { x: 0, y: 0, z: 0 },
      };
    }
  };

  const setTwistValue = (message: any, axis: Axis, value: number) => {
    const target = config.stamped ? message.twist : message;
    const [category, direction] = axis.field.split("-");
    if (category && direction) {
      target[category][direction] = value;
    }
  };

  useLayoutEffect(() => {
    if (speed == undefined || !currentTopic) {
      return;
    }

    const publishMessage = () => {
      const message = createMessage();
      setTwistValue(message, config.xAxis, speed.x);
      setTwistValue(message, config.yAxis, speed.y);
      context.publish?.(currentTopic, message);
    };

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
  }, [context, config, currentTopic, speed]);

  useLayoutEffect(() => {
    renderDone();
  }, [renderDone]);

  const canPublish = context.publish != undefined && config.publishRate > 0;
  const hasTopic = Boolean(currentTopic);
  const enabled = canPublish && hasTopic;

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      {!canPublish && <EmptyState>Connect to a data source that supports publishing</EmptyState>}
      {canPublish && !hasTopic && (
        <EmptyState>Select a publish topic in the panel settings</EmptyState>
      )}
      {enabled && (
        <JoyVisual
          disabled={!enabled}
          advanced={config.advanced}
          onSpeedChange={(value) => {
            setVelocity(value);
          }}
          xLimit={config.xAxis.limit}
          yLimit={config.yAxis.limit}
        />
      )}
    </ThemeProvider>
  );
}

export default Joy;
