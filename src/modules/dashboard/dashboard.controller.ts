import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats() {
    return this.dashboardService.getStats();
  }

  @Get('sales-chart')
  async getSalesChart(
    @Query('year') year?: string,
    @Query('compareYear') compareYear?: string,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const cy = compareYear ? parseInt(compareYear, 10) : undefined;
    return this.dashboardService.getSalesChart(y, cy);
  }

  @Get('top-products')
  async getTopProducts(@Query('limit') limit?: string) {
    return this.dashboardService.getTopProducts(limit ? parseInt(limit, 10) : 10);
  }

  @Get('top-customers')
  async getTopCustomers(@Query('limit') limit?: string) {
    return this.dashboardService.getTopCustomers(limit ? parseInt(limit, 10) : 20);
  }
}
