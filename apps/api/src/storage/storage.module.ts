import { Module } from '@nestjs/common';
import { LocalObjectStoreService } from './local-object-store.service';

@Module({
  providers: [LocalObjectStoreService],
  exports: [LocalObjectStoreService],
})
export class StorageModule {}
