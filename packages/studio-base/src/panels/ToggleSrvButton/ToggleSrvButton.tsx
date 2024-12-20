// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, Palette, Typography } from "@mui/material";
import * as _ from "lodash-es";
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import { makeStyles } from "tss-react/mui";

import Log from "@foxglove/log";
import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/studio";
import Stack from "@foxglove/studio-base/components/Stack";
import { Config } from "@foxglove/studio-base/panels/ToggleSrvButton/types";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

import { defaultConfig, settingsActionReducer, useSettingsTree } from "./settings";

import "./styles.css";


const log = Log.getLogger(__dirname);

type Props = {
  context: PanelExtensionContext;
};

type SrvState = {
  status: "requesting" | "error" | "success";
  value: string;
};

const useStyles = makeStyles<{ state: boolean }>()((theme, { state }) => {
  const buttonColor = state ? "#090" : "#900";
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

function parseInput(value: string): { error?: string; parsedObject?: unknown } {
  let parsedObject;
  let error = undefined;
  try {
    const parsedAny: unknown = JSON.parse(value);
    if (Array.isArray(parsedAny)) {
      error = "Request content must be an object, not an array";
    } else if (parsedAny == undefined) {
      error = "Request content must be an object, not null";
    } else if (typeof parsedAny !== "object") {
      error = `Request content must be an object, not ‘${typeof parsedAny}’`;
    } else {
      parsedObject = parsedAny;
    }
  } catch (e) {
    error = value.length !== 0 ? e.message : "Enter valid request content as JSON";
  }
  return { error, parsedObject };
}

// Wrapper component with ThemeProvider so useStyles in the panel receives the right theme.
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

  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
  const [renderDone, setRenderDone] = useState<() => void>(() => () => { });
  const [srvState, setSrvState] = useState<SrvState | undefined>();
  const [config, setConfig] = useState<Config>(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));
  const [reqButtonState, setReqButtonState] = useState<boolean>(config.initialValue);
  const { classes } = useStyles({ state: reqButtonState });

  useEffect(() => {
    context.saveState(config);
    context.setDefaultPanelTitle(
      config.serviceName ? `Call service ${config.serviceName}` : undefined,
    );
  }, [config, context]);

  useEffect(() => {
    context.watch("colorScheme");

    context.onRender = (renderSrvState, done) => {
      setRenderDone(() => done);
      setColorScheme(renderSrvState.colorScheme ?? "light");
    };

    return () => {
      context.onRender = undefined;
    };
  }, [context, setColorScheme]);

  useEffect(() => {
    setReqButtonState(config.initialValue);
  }, [config.initialValue]);

  const { error: requestParseError, parsedObject } = useMemo(
    () => parseInput(config.requestPayload ?? ""),
    [config.requestPayload],
  );

  const settingsActionHandler = useCallback(
    (action: SettingsTreeAction) => {
      setConfig((prevConfig) => settingsActionReducer(prevConfig, action));
    },
    [setConfig],
  );

  const settingsTree = useSettingsTree(config);
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
    config.requestPayload &&
    config.serviceName &&
    parsedObject != undefined &&
    requestParseError == undefined &&
    srvState?.status !== "requesting",
  );

  const toggleSrvButtonClicked = useCallback(async () => {
    if (!context.callService) {
      setSrvState({ status: "error", value: "The data source does not allow calling services" });
      return;
    }

    try {
      setSrvState({ status: "requesting", value: `Calling ${config.serviceName}...` });
      const requestPayload = JSON.parse("{ \"data\": " + reqButtonState + " }");
      const response = await context.callService(
        config.serviceName!,
        requestPayload,
      ) as { success?: boolean };
      setSrvState({
        status: "success",
        value: JSON.stringify(response, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2) ?? "",
      });
      if (response.success === true) {
        setReqButtonState(!reqButtonState);
      }
    } catch (err) {
      setSrvState({ status: "error", value: (err as Error).message });
      log.error(err);
    }
  }, [reqButtonState, context, config.serviceName]);

  // Indicate render is complete - the effect runs after the dom is updated
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
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
                {reqButtonState ? config.buttonActive : config.buttonDisable}
              </Button>
            </span>
          </Stack>
        </div>
      </Stack>
    </Stack>
  );
}
