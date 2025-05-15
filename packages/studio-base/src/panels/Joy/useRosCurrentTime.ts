// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// src/hooks/useRosCurrentTime.ts

import { useEffect, useState } from "react";

import { Time } from "@foxglove/rostime";
import { useMessagePipelineGetter } from "@foxglove/studio-base/components/MessagePipeline";

const DEFAULT_UPDATE_INTERVAL_MS = 500;

export function useRosCurrentTime(): Time | undefined {
  const messagePipeline = useMessagePipelineGetter();
  const [currentTime, setCurrentTime] = useState<Time | undefined>();

  useEffect(() => {
    const interval = setInterval(() => {
      const { playerState } = messagePipeline();
      setCurrentTime(playerState.activeData?.currentTime);
    }, DEFAULT_UPDATE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [messagePipeline]);

  return currentTime;
}
