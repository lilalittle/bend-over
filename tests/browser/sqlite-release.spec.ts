import {test,expect} from "@playwright/test";

test("extracted companion persists after worker termination and reload",async({page})=>{
  await page.goto("/web/");
  await expect(page.locator("#count")).toHaveText("0");
  await page.getByRole("button",{name:"Increment",exact:true}).click();
  await expect(page.locator("#count")).toHaveText("1");
  await page.reload();
  await expect(page.locator("#count")).toHaveText("1");
});

test("extracted companion excludes competing tabs and releases storage",async({page,context})=>{
  await page.goto("/web/"); await expect(page.locator("#count")).toHaveText("0");
  const second=await context.newPage();await second.goto("/web/");
  await expect(second.locator("#status")).toContainText("OPFS unavailable or busy");
  await page.getByRole("button",{name:"Release storage"}).click();
  await expect(page.locator("#status")).toContainText("Storage released");
  await second.reload();await expect(second.locator("#count")).toHaveText("0");
});

test("extracted companion runs the full Bend contract in a worker",async({page})=>{
  await page.goto("/web/client.js");
  await page.evaluate(async()=>{
    const {createCounter}=await import("/web/client.js");const client=createCounter();
    try{await client.ready();await client.contract();}finally{await client.dispose();}
  });
});
