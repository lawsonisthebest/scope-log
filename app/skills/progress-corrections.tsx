"use client";
import { useState } from "react";
import { ActionForm, Field, Modal } from "../components/ui";
import { dateInZone, type AutomaticProgress } from "../lib/progress";
import { correctCompletion, correctTime } from "./corrections";

export type CorrectionSelection = { kind: "completion" | "time"; id: string };
export function ProgressCorrection({
  selection,
  data,
  zone,
  today,
  onClose,
  onSaved,
}: {
  selection: CorrectionSelection;
  data: AutomaticProgress;
  zone: string;
  today: string;
  onClose: () => void;
  onSaved: (date: string) => void;
}) {
  const [roomId, setRoomId] = useState(selection.id || data.rooms[0]?.id || "");
  const room = data.rooms.find((row) => row.id === roomId);
  const time = data.time.find((row) => row.id === selection.id);
  const completion = selection.kind === "completion";
  if (!completion && !time) return null;
  const date = completion
    ? room?.completedOn ||
      (room?.completedAt ? dateInZone(room.completedAt, zone) : today)
    : time!.recordedOn || dateInZone(time!.createdAt, zone);
  return (
    <Modal
      title={completion ? "Change room completion" : "Edit time entry"}
      description={
        completion
          ? "Choose the day you actually finished. Your calendar, totals, and streak will update automatically."
          : "Edit the whole saved session. Changing its date or duration assigns all of its time to the selected day; changing only the description keeps its original time intervals."
      }
      onClose={onClose}
    >
      <ActionForm
        action={
          completion ? correctCompletion : correctTime.bind(null, time!.id)
        }
        label="Save changes"
        onSuccess={(value) => {
          if (
            value &&
            typeof value === "object" &&
            "date" in value &&
            typeof value.date === "string"
          )
            onSaved(value.date);
          onClose();
        }}
      >
        <input type="hidden" name="timeZone" value={zone} />
        {completion && (
          <Field label="Room">
            <select
              className="field"
              name="projectId"
              required
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
            >
              {data.rooms.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                  {row.status === "Complete" ? " · completed" : ""}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={completion ? "Completion date" : "Session date"}>
          <input
            key={roomId}
            name="date"
            className="field"
            type="date"
            required
            max={today}
            defaultValue={date}
          />
        </Field>
        {!completion && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Minutes">
                <input
                  name="minutes"
                  type="number"
                  min={0}
                  max={1440}
                  required
                  className="field"
                  defaultValue={Math.floor(time!.seconds / 60)}
                />
              </Field>
              <Field label="Seconds">
                <input
                  name="seconds"
                  type="number"
                  min={0}
                  max={59}
                  required
                  className="field"
                  defaultValue={time!.seconds % 60}
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                className="field"
                name="description"
                rows={3}
                maxLength={2000}
                defaultValue={time!.description || ""}
              />
            </Field>
          </>
        )}
      </ActionForm>
    </Modal>
  );
}
