import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { ImportController } from './import.controller';
import type { ImportJobService } from './import-job.service';
import type { ImportReviewService } from './import-review.service';
import type { ImportStatisticsService } from './import-statistics.service';
import type { StorageService } from '../storage/storage.service';
import type { ImportDemoGenerator } from './demo/import-demo.generator';

function fakeRequest(): Request {
  return { headers: {}, user: { id: 'u1' } } as unknown as Request;
}

describe('ImportController.scan — source selection (12, 13)', () => {
  function build() {
    const jobs = { runScan: vi.fn().mockResolvedValue({ id: 'job-1' }) } as unknown as ImportJobService;
    const review = {} as ImportReviewService;
    const stats = {} as ImportStatisticsService;
    const storage = {} as StorageService;
    const demo = {} as ImportDemoGenerator;
    const controller = new ImportController(jobs, review, stats, storage, demo);
    return { controller, jobs };
  }

  it('12. starts a GOOGLE_DRIVE scan when the caller specifies it, without requiring a folder id', () => {
    const { controller, jobs } = build();
    controller.scan({ source: 'GOOGLE_DRIVE', name: 'Weekly Drive import' }, fakeRequest());
    expect(jobs.runScan).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'u1' }), 'GOOGLE_DRIVE', '', 'Weekly Drive import');
  });

  it('12b. forwards an explicit Drive folder id when the caller supplies one', () => {
    const { controller, jobs } = build();
    controller.scan({ source: 'GOOGLE_DRIVE', sourceLocation: 'explicit-folder-id' }, fakeRequest());
    expect(jobs.runScan).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'u1' }), 'GOOGLE_DRIVE', 'explicit-folder-id', undefined);
  });

  it('13. defaults to LOCAL when `source` is omitted (unchanged behavior for existing callers)', () => {
    const { controller, jobs } = build();
    controller.scan({ sourceLocation: '/mnt/legacy-qms' }, fakeRequest());
    expect(jobs.runScan).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'u1' }), 'LOCAL', '/mnt/legacy-qms', undefined);
  });

  it('13b. an explicit LOCAL source still requires and forwards the folder path unchanged', () => {
    const { controller, jobs } = build();
    controller.scan({ source: 'LOCAL', sourceLocation: '/mnt/legacy-qms', name: 'Legacy migration' }, fakeRequest());
    expect(jobs.runScan).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'u1' }), 'LOCAL', '/mnt/legacy-qms', 'Legacy migration');
  });
});
