import { Request, Response, NextFunction } from 'express';
import * as repo from './clients.repository';
import { NotFoundError } from '../../shared/errors';

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json(await repo.findAllClients());
  } catch (e) { next(e); }
}

export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await repo.findClientById(Number(req.params.id));
    if (!client) throw new NotFoundError('Client', req.params.id);
    const kpis = await repo.findKpisByClientId(client.id);
    res.json({ ...client, kpis });
  } catch (e) { next(e); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await repo.createClient(req.body);
    res.status(201).json(client);
  } catch (e) { next(e); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const client = await repo.updateClient(Number(req.params.id), req.body);
    if (!client) throw new NotFoundError('Client', req.params.id);
    res.json(client);
  } catch (e) { next(e); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const deleted = await repo.deleteClient(Number(req.params.id));
    if (!deleted) throw new NotFoundError('Client', req.params.id);
    res.status(204).send();
  } catch (e) { next(e); }
}

export async function getKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kpis = await repo.findKpisByClientId(Number(req.params.id));
    res.json(kpis);
  } catch (e) { next(e); }
}

export async function upsertKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kpis = await repo.upsertKpis(Number(req.params.id), req.body.kpis);
    res.json(kpis);
  } catch (e) { next(e); }
}
