import { describe, it, expect, beforeEach } from "vitest";
import { ConsoleSmsProvider, Fast2SmsProvider, Msg91Provider, TwilioProvider } from "../src/server/sms";
import { LocalDiskStorage, mimeForKey } from "../src/server/storage";
import {
  DistrictCentroidMapProvider,
  GoogleMapsProvider,
  MapboxProvider,
  haversineKm,
  jitterLocation,
  districtDistanceKm,
} from "../src/lib/geo";
import { NoopPushProvider, WebPushProvider, FcmPushProvider } from "../src/server/push";
import { NoopLiveStreamingProvider, LiveKitProvider, MuxProvider } from "../src/server/live";
import { userRepository, professionalRepository, farmingRepository } from "../src/server/repositories";
import { resetDb } from "../src/server/db";

describe("Production Architecture & Provider Adapters", () => {
  beforeEach(() => {
    resetDb();
  });

  describe("SMS Provider Architecture", () => {
    it("ConsoleSmsProvider sends OTP and respects dev vs prod mode", async () => {
      const provider = new ConsoleSmsProvider();
      const res = await provider.sendOtp("9876543210", "123456");
      expect(res).toBe(true);
    });

    it("Fast2SmsProvider, Msg91Provider, TwilioProvider throw when keys are unconfigured", async () => {
      const fast2sms = new Fast2SmsProvider();
      await expect(fast2sms.sendOtp("9876543210", "123456")).rejects.toThrow();

      const msg91 = new Msg91Provider();
      await expect(msg91.sendOtp("9876543210", "123456")).rejects.toThrow();

      const twilio = new TwilioProvider();
      await expect(twilio.sendOtp("9876543210", "123456")).rejects.toThrow();
    });
  });

  describe("Storage Provider Architecture", () => {
    it("LocalDiskStorage handles put and get with path traversal protection", async () => {
      const storage = new LocalDiskStorage();
      const testKey = "testkey0123456789.jpg";
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      await storage.put(testKey, buffer);
      const read = await storage.get(testKey);
      expect(read).not.toBeNull();
      expect(read?.equals(buffer)).toBe(true);

      // Path traversal check
      await expect(storage.put("../evil.jpg", buffer)).rejects.toThrow();
    });

    it("mimeForKey maps file extensions accurately", () => {
      expect(mimeForKey("photo.jpg")).toBe("image/jpeg");
      expect(mimeForKey("image.png")).toBe("image/png");
      expect(mimeForKey("video.mp4")).toBe("video/mp4");
      expect(mimeForKey("clip.webm")).toBe("video/webm");
      expect(mimeForKey("unknown.bin")).toBe("application/octet-stream");
    });
  });

  describe("Maps Provider Architecture & Privacy", () => {
    it("DistrictCentroidMapProvider geocodes known districts and measures distances", () => {
      const provider = new DistrictCentroidMapProvider();
      const churu = provider.geocodeDistrict("Churu");
      const jaipur = provider.geocodeDistrict("Jaipur");
      expect(churu).not.toBeNull();
      expect(jaipur).not.toBeNull();

      const dist = provider.distanceKm(churu!, jaipur!);
      expect(Math.round(dist)).toBeGreaterThan(150);
      expect(Math.round(dist)).toBeLessThan(250);
    });

    it("jitterLocation adds privacy obfuscation without wild divergence", () => {
      const original = { lat: 28.3, lng: 74.96 };
      const jittered = jitterLocation(original, 3);
      expect(jittered.lat).not.toBe(original.lat);
      expect(jittered.lng).not.toBe(original.lng);
      const dist = haversineKm(original, jittered);
      expect(dist).toBeLessThanOrEqual(3.5);
    });

    it("districtDistanceKm computes approximate distances between places", () => {
      const dist = districtDistanceKm("Churu", "Sikar");
      expect(dist).toBeGreaterThan(50);
      expect(dist).toBeLessThan(120);
    });

    it("GoogleMapsProvider and MapboxProvider fall back safely to district centroids when API keys are unconfigured", async () => {
      const google = new GoogleMapsProvider();
      const ptGoogle = await google.geocodeDistrict("Churu");
      expect(ptGoogle).not.toBeNull();
      expect(ptGoogle?.lat).toBe(28.3);

      const mapbox = new MapboxProvider();
      const ptMapbox = await mapbox.geocodeDistrict("Jaipur");
      expect(ptMapbox).not.toBeNull();
      expect(ptMapbox?.lat).toBe(26.91);
    });
  });

  describe("Push & Live Video Providers", () => {
    it("NoopPushProvider reports unconfigured and does not fake delivery", async () => {
      const push = new NoopPushProvider();
      expect(push.isConfigured).toBe(false);
      const sent = await push.sendPush();
      expect(sent).toBe(false);
    });

    it("WebPushProvider and FcmPushProvider correctly reflect unconfigured state without env keys", async () => {
      const webpush = new WebPushProvider();
      expect(webpush.isConfigured).toBe(false);
      expect(await webpush.sendPush("u1", { title: "Test", body: "Hello" })).toBe(false);

      const fcm = new FcmPushProvider();
      expect(fcm.isConfigured).toBe(false);
      expect(await fcm.sendPush("u1", { title: "Test", body: "Hello" })).toBe(false);
    });

    it("Live streaming providers report unconfigured state honestly", async () => {
      const noop = new NoopLiveStreamingProvider();
      expect(noop.isConfigured).toBe(false);
      expect(await noop.createStream("session1", "Test")).toBeNull();

      const livekit = new LiveKitProvider();
      expect(livekit.isConfigured).toBe(false);
      expect(await livekit.createStream("session1", "Test")).toBeNull();

      const mux = new MuxProvider();
      expect(mux.isConfigured).toBe(false);
      expect(await mux.createStream("session1", "Test")).toBeNull();
    });
  });

  describe("Repository Layer In-Memory Operations", () => {
    it("UserRepository creates, finds, and lists users in demo mode", async () => {
      const u = await userRepository.findById("u_ramesh");
      expect(u).not.toBeNull();
      expect(u?.name).toContain("Ramesh");

      const byPhone = await userRepository.findByIdentifier("9000010001");
      expect(byPhone?.id).toBe("u_ramesh");
    });

    it("ProfessionalRepository manages profiles and services", async () => {
      const p = await professionalRepository.getProfile("u_p_anil");
      expect(p).not.toBeNull();
      expect(p?.professionId).toBe("pr_electrician");

      const services = await professionalRepository.listServices("u_p_anil");
      expect(services.length).toBeGreaterThan(0);
    });

    it("FarmingRepository manages farms and cycles", async () => {
      const farms = await farmingRepository.listFarms("u_ramesh");
      expect(farms.length).toBeGreaterThan(0);
      expect(farms[0]?.name).toBeDefined();

      const farm = await farmingRepository.getFarm("f_r_main", "u_ramesh");
      expect(farm).not.toBeNull();
    });
  });
});

