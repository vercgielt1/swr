import React, { useCallback, useEffect, useState } from "react";
import useSWRSubscription from "swr/subscription";
import EventEmitter from "events";

const event = new EventEmitter();

const swrKey = "sub-key";

export default function page() {
  const [isOn, setIsOn] = useState(true);
  const [num, setNum] = useState(0);

  useEffect(() => {
    if (num % 3 === 1) {
      const err = new Error("error:" + num);
      event.emit("error", err);
    } else {
      event.emit("data", "state:" + num);
    }
  }, [num]);

  const subscribe = useCallback(
    (key, { next }) => {
      if (!isOn) return;
      event.on("data", (value) => next(undefined, value));
      event.on("error", (err) => next(err));

      return () => {
        setIsOn(false);
      };
    },
    [isOn]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setNum(num + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [num]);

  const { data, error } = useSWRSubscription(swrKey, subscribe);
  return (
    <div>
      <h3>SWR Subscription</h3>
      <h4>Recieved every second</h4>
      <div>{data}</div>
      <div>{error ? error.message : ""}</div>
    </div>
  );
}
