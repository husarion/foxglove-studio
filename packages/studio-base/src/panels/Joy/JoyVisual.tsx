// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import React, { useCallback, useState, useRef } from "react";
import "./styles.css";

const joyRadius = 37;

const Arrow = ({ direction, width = 20, height = 7 }: { direction: string; width?: number; height?: number }) => {
  let points;

  switch (direction) {
    case 'up':
      points = `${50},${0} ${50 - width / 2},${height} ${50 + width / 2},${height}`;
      break;
    case 'down':
      points = `${50},100 ${50 - width / 2},${100 - height} ${50 + width / 2},${100 - height}`;
      break;
    case 'left':
      points = `${0},${50} ${height},${50 - width / 2} ${height},${50 + width / 2}`;
      break;
    case 'right':
      points = `100,${50} ${100 - height},${50 - width / 2} ${100 - height},${50 + width / 2}`;
      break;
    default:
      points = '';
  }

  return <polygon points={points} className="joystick-triangle" />;
};

// Type for the Joystick Props
type JoyVisualProps = {
  disabled?: boolean;
  onSpeedChange?: (pos: { x: number; y: number }) => void;
  xLimit?: number;
  yLimit?: number;
};

// Component for the JoyVisual
function JoyVisual(props: JoyVisualProps): JSX.Element {
  const joystickRef = useRef<SVGCircleElement>(null);
  const handleRef = useRef<SVGCircleElement>(null);
  const { onSpeedChange, disabled = false, xLimit, yLimit } = props;
  const [speed, setSpeed] = useState<{ x: number; y: number } | undefined>();
  const [startPos, setStartPos] = useState<{ x: number; y: number } | undefined>();
  const [isDragging, setIsDragging] = useState(false);
  const [scaleX, setScaleX] = useState(0.5);
  const [scaleY, setScaleY] = useState(0.5);
  const [isEditing, setIsEditing] = useState(false);

  const handleStart = useCallback(
    (event: React.MouseEvent<SVGCircleElement> | React.TouchEvent<SVGCircleElement>) => {
      if (event.type === "mousedown") {
        const mouseEvent = event as React.MouseEvent<SVGCircleElement>;
        if (mouseEvent.button !== 0) { return };
      }

      const { clientX, clientY } = "touches" in event ? event.touches[0]! : event;

      setIsDragging(true);
      setStartPos({ x: clientX, y: clientY });

      if (handleRef.current) {
        handleRef.current.style.cursor = "grabbing";
        handleRef.current.style.animation = "none";
      }
    },
    [],
  );

  const handleMove = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const clientX = "touches" in event ? event.touches[0]!.clientX : event.clientX;
      const clientY = "touches" in event ? event.touches[0]!.clientY : event.clientY;

      if (!isDragging || !startPos || !joystickRef.current || !handleRef.current) { return; }

      let dx = clientX - startPos.x;
      let dy = clientY - startPos.y;

      const distance = Math.sqrt(dx * dx + dy * dy);
      const joyRect = joystickRef.current.getBoundingClientRect();
      const maxDistance = joyRect.width / 2;

      if (distance > maxDistance) {
        dx *= maxDistance / distance;
        dy *= maxDistance / distance;
      }

      const x_ratio = dx / maxDistance;
      const y_ratio = dy / maxDistance;

      const v_x = -y_ratio * scaleX;
      const v_y = -x_ratio * scaleY;

      setSpeed({ x: v_x, y: v_y });
      if (!disabled) {
        onSpeedChange?.({ x: v_x, y: v_y });
      }

      const cx = joyRadius * x_ratio + 50
      const cy = joyRadius * y_ratio + 50

      handleRef.current.setAttribute("cx", cx.toString());
      handleRef.current.setAttribute("cy", cy.toString());
    },
    [isDragging, startPos, onSpeedChange, disabled, scaleX, scaleY],
  );


  const handleEnd = useCallback(() => {
    if (speed != undefined || isDragging) {
      setIsDragging(false);
      setSpeed({ x: 0, y: 0 });
      onSpeedChange?.({ x: 0, y: 0 });
      if (handleRef.current) {
        handleRef.current.setAttribute('cx', '50');
        handleRef.current.setAttribute('cy', '50');
        handleRef.current.style.cursor = "";
        handleRef.current.style.animation = "glow 0.6s alternate infinite";
      }
    }
  }, [isDragging, speed, onSpeedChange]);


  React.useEffect(() => {
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [handleEnd, handleMove]);


  return (
    <div id="container">
      <button id="toggle-editing" onClick={() => { setIsEditing(!isEditing); }}>
        {isEditing ? 'Basic Mode' : 'Advanced Mode'}
      </button>
      <div id="joystick-container">
        <svg id="joystick" viewBox="0 0 100 100" aria-label="Joystick" >
          <Arrow direction="up" />
          <Arrow direction="down" />
          <Arrow direction="left" />
          <Arrow direction="right" />
          <circle ref={joystickRef} cx="50" cy="50" r={joyRadius.toString()} className="joystick-background" />
          <circle onMouseDown={handleStart} onTouchStart={handleStart} ref={handleRef} cx="50" cy="50" r="15" className="joystick-handle" />
        </svg>
        {isEditing && (<div id="joystick-position">
          <div>({speed?.x.toFixed(2) ?? "0.00"}, {speed?.y.toFixed(2) ?? "0.00"})</div>
        </div>)}
      </div>
      {isEditing && (
        <div id="controls">
          <div className="slider-container">
            <label htmlFor="xMax">X Axis</label>
            <input
              type="range"
              id="xMax"
              min="0.0"
              max={xLimit}
              step="0.1"
              value={scaleX}
              onChange={(e) => { setScaleX(parseFloat(e.target.value)); }}
            />
            <div className="slider-description">X: {scaleX.toFixed(1)} m/s</div>
          </div>
          <div className="slider-container">
            <label htmlFor="yMax">Y Axis</label>
            <input
              type="range"
              id="yMax"
              min="0.0"
              max={yLimit}
              step="0.1"
              value={scaleY}
              onChange={(e) => { setScaleY(parseFloat(e.target.value)); }}
            />
            <div className="slider-description">Yaw: {scaleY.toFixed(1)} rad/s</div>
          </div>
        </div>
      )}
    </div>);
}

export default JoyVisual;
