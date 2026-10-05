// @vitest-environment jsdom
import {act,cleanup,render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach,describe,expect,it,vi} from "vitest";
import type {ActionResult} from "../../app/lib/validation";
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
import {ActionForm} from "../../app/components/ui";
afterEach(cleanup);
describe("capture form save lifecycle",()=>{
  it("waits for persistence before closing and disables duplicate submission",async()=>{
    let finish!:(result:ActionResult<unknown>)=>void;const action=vi.fn(()=>new Promise<ActionResult<unknown>>(resolve=>{finish=resolve;})),saved=vi.fn();
    render(<ActionForm action={action} onSuccess={saved}><input name="title" aria-label="Title" defaultValue="Research notes"/></ActionForm>);
    await userEvent.click(screen.getByRole("button",{name:"Save"}));
    expect(saved).not.toHaveBeenCalled();expect((screen.getByRole("button",{name:"Saving…"}) as HTMLButtonElement).disabled).toBe(true);expect(action).toHaveBeenCalledTimes(1);
    await act(async()=>finish({ok:true,data:undefined}));await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));
  });
  it("retains input and displays a validation failure",async()=>{
    const saved=vi.fn();render(<ActionForm action={async()=>({ok:false,error:"Choose a valid severity."})} onSuccess={saved}><input name="title" aria-label="Title" defaultValue="Keep this finding"/></ActionForm>);
    await userEvent.click(screen.getByRole("button",{name:"Save"}));expect(await screen.findByRole("alert")).toHaveProperty("textContent","Choose a valid severity.");expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Keep this finding");expect(saved).not.toHaveBeenCalled();
  });
  it("retains input after an unexpected network failure",async()=>{
    render(<ActionForm action={async()=>{throw new Error("network");}}><input aria-label="Title" defaultValue="Preserved"/></ActionForm>);await userEvent.click(screen.getByRole("button",{name:"Save"}));expect((await screen.findByRole("alert")).textContent).toContain("Connection interrupted");expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Preserved");
  });
});
