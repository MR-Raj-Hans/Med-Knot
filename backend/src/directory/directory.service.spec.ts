import { BadRequestException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service.js';
import { DirectoryService } from './directory.service.js';
import type { DirectoryQueryDto } from './dto/directory-query.dto.js';

describe('DirectoryService', () => {
  it('queries only approved and active hospitals with bounded pagination', async () => {
    const args: unknown[] = [];
    const database = {
      hospital: { findMany: async (input: unknown) => { args.push(input); return []; } },
    } as unknown as DatabaseService;
    const service = new DirectoryService(database);

    await service.listHospitals({ page: 2, pageSize: 10, city: 'Pune' } as DirectoryQueryDto);

    expect(args[0]).toMatchObject({
      where: { status: 'ACTIVE', verificationStatus: 'APPROVED', city: { contains: 'Pune', mode: 'insensitive' } },
      skip: 10,
      take: 11,
    });
  });

  it('requires a complete coordinate pair for nearby search', async () => {
    const database = { hospital: { findMany: async () => [] }, $queryRaw: async () => [] } as unknown as DatabaseService;
    const service = new DirectoryService(database);

    await expect(service.listHospitals({ page: 1, pageSize: 20, latitude: 18.5 } as DirectoryQueryDto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns server-calculated nearby distances rounded to two decimals', async () => {
    const database = {
      hospital: { findMany: async () => [] },
      department: { findMany: async () => [] },
      $queryRaw: async () => [{ id: 'hospital-id', name: 'Verified Hospital', distanceKm: 3.456, latitude: 18.5, longitude: 73.8 }],
    } as unknown as DatabaseService;
    const service = new DirectoryService(database);

    const result = await service.listHospitals({ page: 1, pageSize: 20, latitude: 18.5, longitude: 73.8 } as DirectoryQueryDto);

    expect(result.items).toMatchObject([{ id: 'hospital-id', distanceKm: 3.46, verified: true }]);
  });
});
