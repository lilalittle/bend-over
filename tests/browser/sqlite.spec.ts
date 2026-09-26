import {test,expect} from '@playwright/test';

test('compiled Bend persists through worker termination and reload',async({page})=>{
  await page.goto('/');
  await expect(page.locator('#count')).toHaveText('0');
  await page.getByRole('button',{name:'Increment',exact:true}).click();
  await expect(page.locator('#count')).toHaveText('1');
  await page.reload();
  await expect(page.locator('#count')).toHaveText('1');
  await page.getByRole('button',{name:'Increment',exact:true}).click();
  await expect(page.locator('#count')).toHaveText('2');
});

test('a competing tab fails explicitly and can reopen after release',async({page,context})=>{
  await page.goto('/');
  await expect(page.locator('#count')).toHaveText('0');
  const second=await context.newPage();
  await second.goto('/');
  await expect(second.locator('#status')).toContainText('OPFS unavailable or busy');
  await expect(second.getByRole('button',{name:'Increment',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Release storage'}).click();
  await expect(page.locator('#status')).toContainText('Storage released');
  await second.reload();
  await expect(second.locator('#count')).toHaveText('0');
  await second.getByRole('button',{name:'Increment',exact:true}).click();
  await expect(second.locator('#count')).toHaveText('1');
});

test('the complete Bend contract runs inside the browser worker',async({page})=>{
  // Do not load the demo, whose own worker would own the pool.
  await page.goto('/client.js');
  await page.evaluate(async()=>{
    const {createCounter}=await import('/client.js');
    const counter=createCounter();
    try { await counter.ready(); await counter.contract(); }
    finally { await counter.dispose(); }
  });
});
