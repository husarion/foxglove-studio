// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, Palette, Typography } from "@mui/material";
import * as _ from "lodash-es";
import { Dispatch, SetStateAction, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { parseMessagePath, MessagePath } from "@foxglove/message-path";
import { MessageEvent, PanelExtensionContext, SettingsTreeAction } from "@foxglove/studio";
import { simpleGetMessagePathDataItems } from "@foxglove/studio-base/components/MessagePathSyntax/simpleGetMessagePathDataItems";
import NotificationModal from "@foxglove/studio-base/components/NotificationModal";
import Stack from "@foxglove/studio-base/components/Stack";
import { Config } from "@foxglove/studio-base/panels/ToggleSrvButton/types";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import { defaultConfig, settingsActionReducer, useSettingsTree } from "./settings";

import "./styles.css";

type Props = {
  context: PanelExtensionContext;
};

type ButtonState = "activated" | "deactivated" | undefined;
type SrvResponse = { success: boolean; message: string };

type SrvState = {
  status: "requesting" | "error" | "success";
  response: SrvResponse | undefined;
};

type State = {
  path: string;
  parsedPath: MessagePath | undefined;
  latestMessage: MessageEvent | undefined;
  latestMatchingQueriedData: unknown;
  error: Error | undefined;
  pathParseError: string | undefined;
};

type Action =
  | { type: "frame"; messages: readonly MessageEvent[] }
  | { type: "path"; path: string }
  | { type: "seek" };

const useStyles = makeStyles<{ action?: ButtonState; config: Config }>()((theme, { action, config }) => {
  const buttonColor = action === "activated" ? config.deactivationColor : config.activationColor;
  const augmentedButtonColor = theme.palette.augmentColor({
    color: { main: buttonColor },
  });

  return {
    button: {
      backgroundColor: augmentedButtonColor.main,
      color: augmentedButtonColor.contrastText,

      "&:hover": {
        backgroundColor: augmentedButtonColor.dark,
      },
    },
  };
});

function getSingleDataItem(results: unknown[]) {
  if (results.length <= 1) {
    return results[0];
  }
  throw new Error("Message path produced multiple results");
}

function reducer(state: State, action: Action): State {
  try {
    switch (action.type) {
      case "frame": {
        if (state.pathParseError != undefined) {
          return { ...state, latestMessage: _.last(action.messages), error: undefined };
        }
        let latestMatchingQueriedData = state.latestMatchingQueriedData;
        let latestMessage = state.latestMessage;
        if (state.parsedPath) {
          for (const message of action.messages) {
            if (message.topic !== state.parsedPath.topicName) {
              continue;
            }
            const data = getSingleDataItem(
              simpleGetMessagePathDataItems(message, state.parsedPath),
            );
            if (data != undefined) {
              latestMatchingQueriedData = data;
              latestMessage = message;
            }
          }
        }
        return { ...state, latestMessage, latestMatchingQueriedData, error: undefined };
      }
      case "path": {
        const newPath = parseMessagePath(action.path);
        let pathParseError: string | undefined;
        if (
          newPath?.messagePath.some(
            (part) =>
              (part.type === "filter" && typeof part.value === "object") ||
              (part.type === "slice" &&
                (typeof part.start === "object" || typeof part.end === "object")),
          ) === true
        ) {
          pathParseError = "Message paths using variables are not currently supported";
        }
        let latestMatchingQueriedData: unknown;
        let error: Error | undefined;
        try {
          latestMatchingQueriedData =
            newPath && pathParseError == undefined && state.latestMessage
              ? getSingleDataItem(simpleGetMessagePathDataItems(state.latestMessage, newPath))
              : undefined;
        } catch (err) {
          error = err;
        }
        return {
          ...state,
          path: action.path,
          parsedPath: newPath,
          latestMatchingQueriedData,
          error,
          pathParseError,
        };
      }
      case "seek":
        return {
          ...state,
          latestMessage: undefined,
          latestMatchingQueriedData: undefined,
          error: undefined,
        };
    }
  } catch (error) {
    return { ...state, latestMatchingQueriedData: undefined, error };
  }
}

export function ToggleSrvButton({ context }: Props): JSX.Element {
  const [colorScheme, setColorScheme] = useState<Palette["mode"]>("light");

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <ToggleSrvButtonContent context={context} setColorScheme={setColorScheme} />
    </ThemeProvider>
  );
}

function ToggleSrvButtonContent(
  props: Props & { setColorScheme: Dispatch<SetStateAction<Palette["mode"]>> },
): JSX.Element {
  const { context, setColorScheme } = props;
  const [renderDone, setRenderDone] = useState<() => void>(() => () => { });
  const [srvState, setSrvState] = useState<SrvState | undefined>();
  const [config, setConfig] = useState(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));
  const [buttonAction, setButtonAction] = useState<ButtonState | undefined>(undefined);
  const { classes } = useStyles({ action: buttonAction, config });

  const [state, dispatch] = useReducer(
    reducer,
    { ...config, path: config.statusTopicName },
    ({ path }): State => ({
      path,
      parsedPath: parseMessagePath(path),
      latestMessage: undefined,
      latestMatchingQueriedData: undefined,
      pathParseError: undefined,
      error: undefined,
    }),
  );

  const handleRequestCloseNotification = () => {
    setSrvState(undefined);
  };

  useLayoutEffect(() => {
    dispatch({ type: "path", path: config.statusTopicName });
  }, [config.statusTopicName]);

  useEffect(() => {
    context.saveState(config);
    context.setDefaultPanelTitle(
      config.serviceName ? `Call service ${config.serviceName}` : undefined,
    );
  }, [config, context]);

  useEffect(() => {
    context.watch("colorScheme");

    context.onRender = (renderState, done) => {
      setRenderDone(() => done);
      setColorScheme(renderState.colorScheme ?? "light");

      if (renderState.didSeek === true) {
        dispatch({ type: "seek" });
      }

      if (renderState.currentFrame) {
        dispatch({ type: "frame", messages: renderState.currentFrame });
      }
    };
    context.watch("currentFrame");
    context.watch("didSeek");

    return () => {
      context.onRender = undefined;
    };
  }, [context, setColorScheme]);

  useEffect(() => {
    if (state.parsedPath?.topicName != undefined) {
      context.subscribe([{ topic: state.parsedPath.topicName, preload: false }]);
    }
    return () => {
      context.unsubscribeAll();
    };
  }, [context, state.parsedPath?.topicName]);

  const settingsActionHandler = useCallback(
    (action: SettingsTreeAction) => {
      setConfig((prevConfig) => settingsActionReducer(prevConfig, action));
    },
    [setConfig],
  );

  const settingsTree = useSettingsTree(config, state.pathParseError);
  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler: settingsActionHandler,
      nodes: settingsTree,
    });
  }, [context, settingsActionHandler, settingsTree]);

  const statusMessage = useMemo(() => {
    if (context.callService == undefined) {
      return "Connect to a data source that supports calling services";
    }
    if (!config.serviceName) {
      return "Configure a service in the panel settings";
    }
    return undefined;
  }, [context, config.serviceName]);

  const canToggleSrvButton = Boolean(
    context.callService != undefined &&
    config.serviceName &&
    config.statusTopicName &&
    buttonAction != undefined &&
    srvState?.status !== "requesting",
  );

  const toggleSrvButtonClicked = useCallback(async () => {
    if (!context.callService) {
      setSrvState({ status: "error", response: undefined });
      return;
    }

    if (buttonAction != undefined) {
      setSrvState({ status: "requesting", response: undefined });
      const requestPayload = { data: buttonAction === "activated" ? false : true };
      const response = await context.callService(config.serviceName, requestPayload) as SrvResponse;
      setSrvState({ status: "success", response });
    }
  }, [context, buttonAction, config]);

  // Setting buttonAction based on received state
  useEffect(() => {
    const data = state.latestMatchingQueriedData;
    if (typeof data === "boolean") {
      const isDeactivated = data === config.reverseLogic;
      setButtonAction(isDeactivated ? "deactivated" : "activated");
    }
  }, [state.latestMatchingQueriedData, config.reverseLogic]);

  // Indicate render is complete - the effect runs after the dom is updated
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <>
      <Stack flex="auto" gap={1} padding={1.5} position="relative" fullHeight>
        <Stack justifyContent="center" alignItems="center" fullWidth fullHeight>
          <div className="center">
            <Stack
              direction="column-reverse"
              justifyContent="center"
              alignItems="center"
              overflow="hidden"
              flexGrow={0}
              gap={1.5}
            >
              {statusMessage && (
                <Typography variant="caption" noWrap>
                  {statusMessage}
                </Typography>
              )}
              <span>
                <Button
                  className={classes.button}
                  variant="contained"
                  disabled={!canToggleSrvButton}
                  onClick={toggleSrvButtonClicked}
                  data-testid="call-service-button"
                  style={{
                    minWidth: "150px",
                    minHeight: "70px",
                    fontSize: "1.7rem",
                    borderRadius: "0.3rem",
                  }}
                >
                  {buttonAction === "activated" ? config.deactivationText : buttonAction === "deactivated" ? config.activationText : "Unknown"}
                </Button>
              </span>
            </Stack>
          </div>
        </Stack>
      </Stack>
      {srvState?.response?.success === false && (
        <NotificationModal
          onRequestClose={handleRequestCloseNotification}
          notification={{
            id: "1",
            message: "Request Failed",
            details: srvState.response.message,
            severity: "error",
          }}
        />
      )}
    </>
  );
}
