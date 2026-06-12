import { device, cleanup } from 'detox';

// Run before all tests in the suite
beforeAll(async () => {
  await device.launchApp({
    newInstance: true,
    // Clear AsyncStorage / persisted Zustand state between full runs
    delete: true,
  });
});

// Run after every test — clear storage so each test starts clean
afterEach(async () => {
  await device.clearKeychain();
});

afterAll(async () => {
  await cleanup();
});
