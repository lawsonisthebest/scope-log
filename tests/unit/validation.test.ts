import {describe,it,expect} from "vitest";
import {choice,dueDate,id,integer,isId,sourceUrl,text,ValidationError,severities} from "../../app/lib/validation";
describe("input boundaries",()=>{
  it("requires trimmed text and rejects oversized/non-text input",()=>{expect(text("  Report  ","Name")).toBe("Report");for(const v of [null,{},"  ","x".repeat(201)])expect(()=>text(v,"Name")).toThrow(ValidationError);expect(text(null,"Notes",10,true)).toBe("");});
  it("rejects invalid IDs before database queries",()=>{expect(isId("00000000-0000-0000-0000-000000000001")).toBe(true);for(const v of ["not-a-uuid","' OR 1=1",null])expect(()=>id(v)).toThrow(ValidationError);});
  it("restricts enum values",()=>{expect(choice("High",severities,"Severity")).toBe("High");expect(()=>choice("urgent",severities,"Severity")).toThrow();});
  it("rejects invalid numeric inputs instead of silently clamping",()=>{expect(integer("100",0,100,"Progress")).toBe(100);for(const v of [NaN,Infinity,-1,101,1.2,"",null,"abc"])expect(()=>integer(v,0,100,"Progress")).toThrow();});
  it("validates actual dates including leap years",()=>{expect(dueDate("2028-02-29")?.toISOString()).toBe("2028-02-29T12:00:00.000Z");expect(dueDate("")).toBeNull();for(const v of ["2026-02-29","2026-04-31","2026-13-01","tomorrow"])expect(()=>dueDate(v)).toThrow();});
  it("permits only web source URLs without credentials",()=>{expect(sourceUrl("https://example.com/evidence")).toBe("https://example.com/evidence");expect(sourceUrl("")).toBeNull();for(const v of ["javascript:alert(1)","data:text/html,test","file:///etc/passwd","https://user:secret@example.com","example.com"])expect(()=>sourceUrl(v)).toThrow();});
});
