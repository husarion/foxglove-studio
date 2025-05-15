// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// src/components/CurrentTimeDisplay.tsx

import React from "react";

import Panel from "@foxglove/studio-base/components/Panel";
import Stack from "@foxglove/studio-base/components/Stack";

import { DiagnosticSummaryConfig } from "./util";
import { useRosCurrentTime } from "../Joy/useRosCurrentTime";

export function DiagnosticSummary(): JSX.Element {
  const currentTime = useRosCurrentTime();

  return (
    <Stack>
      <strong>Current Time:</strong>{" "}
      {currentTime ? `${currentTime.sec}.${currentTime.nsec}` : "No time yet"}
    </Stack>
  );
}

const defaultConfig: DiagnosticSummaryConfig = {
  minLevel: 0,
  pinnedIds: [],
  hardwareIdFilter: "",
  topicToRender: "/diagnostics",
  sortByLevel: true,
};

export default Panel(
  Object.assign(DiagnosticSummary, {
    panelType: "DiagnosticSummary",
    defaultConfig,
  }),
);
