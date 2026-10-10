/**
 * Professional Repository — manages professional profiles, services, work opportunities,
 * and service requests across Prisma (PostgreSQL) and the in-memory store.
 */
import type {
  ProfessionalProfile,
  Service,
  ServiceRequest,
  WorkOpportunity,
  WorkApplication,
  ServiceRequestStatus,
} from "@/types/domain";
import { db, persist } from "../db";
import { env } from "../env";
import { prisma } from "../prisma";
import { ApiException } from "../errors";

function isProdDb(): boolean {
  return !env().DEMO_MODE;
}

export class ProfessionalRepository {
  async getProfile(userId: string): Promise<ProfessionalProfile | null> {
    if (isProdDb()) {
      try {
        const p = await prisma.professionalProfile.findUnique({
          where: { userId },
          include: { profession: true },
        });
        return p as unknown as ProfessionalProfile | null;
      } catch (err) {
        console.error("[pro.repo:getProfile] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }
    return db().professionalProfiles.find((p) => p.userId === userId) ?? null;
  }

  async upsertProfile(profile: ProfessionalProfile): Promise<ProfessionalProfile> {
    if (isProdDb()) {
      try {
        const upserted = await prisma.professionalProfile.upsert({
          where: { userId: profile.userId },
          update: {
            professionId: profile.professionId,
            secondaryProfessionIds: profile.secondaryProfessionIds ?? [],
            customProfession: profile.customProfession,
            about: profile.about,
            startedYear: profile.startedYear,
            skills: profile.skills as unknown as object,
            languages: profile.languages,
            attributes: profile.attributes as unknown as object,
            village: profile.location?.village,
            district: profile.location?.district ?? "",
            state: profile.location?.state ?? "Rajasthan",
            serviceRadiusKm: profile.location?.serviceRadiusKm ?? 25,
            serviceAreas: profile.location?.serviceAreas ?? [],
            availabilityStatus: profile.availability?.status ?? "OPEN_TO_WORK",
            availability: profile.availability as unknown as object,
            certifications: profile.certifications as unknown as object,
            achievements: profile.achievements as unknown as object,
            privacy: profile.privacy as unknown as object,
            businessId: profile.businessId,
          },
          create: {
            userId: profile.userId,
            professionId: profile.professionId,
            secondaryProfessionIds: profile.secondaryProfessionIds ?? [],
            customProfession: profile.customProfession,
            about: profile.about,
            startedYear: profile.startedYear,
            skills: profile.skills as unknown as object,
            languages: profile.languages,
            attributes: profile.attributes as unknown as object,
            village: profile.location?.village,
            district: profile.location?.district ?? "",
            state: profile.location?.state ?? "Rajasthan",
            serviceRadiusKm: profile.location?.serviceRadiusKm ?? 25,
            serviceAreas: profile.location?.serviceAreas ?? [],
            availabilityStatus: profile.availability?.status ?? "OPEN_TO_WORK",
            availability: profile.availability as unknown as object,
            certifications: profile.certifications as unknown as object,
            achievements: profile.achievements as unknown as object,
            privacy: profile.privacy as unknown as object,
            businessId: profile.businessId,
            isDemo: profile.isDemo ?? false,
          },
        });
        return upserted as unknown as ProfessionalProfile;
      } catch (err) {
        console.error("[pro.repo:upsertProfile] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    const idx = db().professionalProfiles.findIndex((p) => p.userId === profile.userId);
    if (idx >= 0) {
      db().professionalProfiles[idx] = profile;
    } else {
      db().professionalProfiles.push(profile);
    }
    persist();
    return profile;
  }

  async listServices(ownerId?: string): Promise<Service[]> {
    if (isProdDb()) {
      try {
        const where: Record<string, unknown> = { hidden: false };
        if (ownerId) where.ownerId = ownerId;
        const services = await prisma.service.findMany({ where, orderBy: { createdAt: "desc" } });
        return services as unknown as Service[];
      } catch (err) {
        console.error("[pro.repo:listServices] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    let list = db().services.filter((s) => !s.hidden);
    if (ownerId) list = list.filter((s) => s.ownerId === ownerId);
    return list;
  }

  async createService(service: Service): Promise<Service> {
    if (isProdDb()) {
      try {
        const created = await prisma.service.create({
          data: {
            id: service.id,
            ownerId: service.ownerId,
            name: service.name,
            description: service.description,
            price: service.price,
            priceType: service.priceType,
            areas: service.areas,
            availability: service.availability ?? "",
            media: service.media as unknown as object,
            active: service.active,
            hidden: service.hidden,
            isDemo: service.isDemo,
          },
        });
        return created as unknown as Service;
      } catch (err) {
        console.error("[pro.repo:createService] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    db().services.push(service);
    persist();
    return service;
  }

  async createOpportunity(opp: WorkOpportunity): Promise<WorkOpportunity> {
    if (isProdDb()) {
      try {
        const created = await prisma.workOpportunity.create({
          data: {
            id: opp.id,
            posterId: opp.posterId,
            businessId: opp.businessId,
            title: opp.title,
            description: opp.description,
            kind: opp.kind,
            professionIds: opp.professionIds,
            skills: opp.skills,
            openings: opp.openings,
            village: opp.location?.village,
            district: opp.location?.district ?? "",
            state: opp.location?.state ?? "Rajasthan",
            mode: opp.mode,
            payMin: opp.pay?.min,
            payMax: opp.pay?.max,
            payUnit: opp.pay?.unit ?? "NEGOTIABLE",
            duration: opp.duration,
            contactMethod: opp.contactMethod,
            status: opp.status,
            hidden: opp.hidden,
            isDemo: opp.isDemo,
          },
        });
        return created as unknown as WorkOpportunity;
      } catch (err) {
        console.error("[pro.repo:createOpportunity] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    db().workOpportunities.push(opp);
    persist();
    return opp;
  }

  async createApplication(app: WorkApplication): Promise<WorkApplication> {
    if (isProdDb()) {
      try {
        const created = await prisma.workApplication.create({
          data: {
            id: app.id,
            opportunityId: app.opportunityId,
            applicantId: app.applicantId,
            note: app.note,
            status: app.status,
            conversationId: app.conversationId,
            isDemo: app.isDemo,
          },
        });
        return created as unknown as WorkApplication;
      } catch (err) {
        console.error("[pro.repo:createApplication] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    db().applications.push(app);
    persist();
    return app;
  }

  async createServiceRequest(req: ServiceRequest): Promise<ServiceRequest> {
    if (isProdDb()) {
      try {
        const created = await prisma.serviceRequest.create({
          data: {
            id: req.id,
            serviceId: req.serviceId,
            providerId: req.providerId,
            requesterId: req.requesterId,
            date: new Date(req.date),
            village: req.location?.village,
            district: req.location?.district ?? "",
            state: req.location?.state ?? "Rajasthan",
            description: req.description,
            status: req.status,
            conversationId: req.conversationId,
            isDemo: req.isDemo,
          },
        });
        return created as unknown as ServiceRequest;
      } catch (err) {
        console.error("[pro.repo:createServiceRequest] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    db().serviceRequests.push(req);
    persist();
    return req;
  }

  async updateServiceRequestStatus(id: string, status: ServiceRequestStatus): Promise<ServiceRequest | null> {
    if (isProdDb()) {
      try {
        const updated = await prisma.serviceRequest.update({
          where: { id },
          data: { status },
        });
        return updated as unknown as ServiceRequest;
      } catch (err) {
        console.error("[pro.repo:updateServiceRequestStatus] PostgreSQL error:", err);
        throw new ApiException(503, "DATABASE_UNAVAILABLE", "Database is unavailable.");
      }
    }

    const sr = db().serviceRequests.find((r) => r.id === id);
    if (!sr) return null;
    sr.status = status;
    sr.updatedAt = new Date().toISOString();
    persist();
    return sr;
  }
}

export const professionalRepository = new ProfessionalRepository();

