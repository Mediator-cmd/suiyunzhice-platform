/**
 * 图片资源登记表
 *
 * 为什么单独一个文件：
 *   shared/ 是前后端共用的内核，必须保持纯 JS（不能 import 图片，
 *   否则 Node 端会崩）。所以图片 URL 只能放在 web/ 这一侧。
 *
 * 图片来源（全部为团队自有素材或自由许可素材，无版权风险）：
 *   - 原「金穗卫士」平台自带的实景卫星图与病害图
 *   - Wikimedia Commons 的病害实拍（CC 授权）
 *   - Unsplash / Pexels 的真实麦田与植保作业场景
 *   - 团队自有的无人机与机器人实物照片
 */

import fieldSatellite from './assets/scene/field-satellite.jpg';
import fieldWheat from './assets/scene/field-wheat.jpg';
import wheatClose from './assets/scene/wheat-close.jpg';
import wheatGreen from './assets/scene/wheat-green.jpg';
import fieldWheat2 from './assets/scene/field-wheat-2.jpg';
import fieldResearch from './assets/scene/field-research.jpg';
import uavField from './assets/scene/uav-field.jpg';
import uavSpray from './assets/scene/uav-spray.jpg';
import uavFlying from './assets/scene/uav-flying.jpg';
import robotField from './assets/scene/robot-field.jpg';
import tractorSpray from './assets/scene/tractor-spray.jpg';

import disRust from './assets/disease/dis-rust.jpg';
import disPowdery from './assets/disease/dis-powdery.jpg';
import disPowderyB from './assets/disease/dis-powdery-b.jpg';
import disLooseSmut from './assets/disease/dis-loose-smut.jpg';
import disRootRot from './assets/disease/dis-root-rot.jpg';
import disFusarium from './assets/disease/dis-fusarium.jpg';
import disLeafBlight from './assets/disease/dis-leaf-blight.jpg';

import hwUav1 from './assets/hardware/hw-uav-1.jpg';
import hwUav2 from './assets/hardware/hw-uav-2.jpg';
import hwUav3 from './assets/hardware/hw-uav-3.jpg';
import hwRobot from './assets/hardware/hw-robot.jpg';
import hwBoard from './assets/hardware/hw-board.jpg';
import hwField1 from './assets/hardware/hw-field-1.jpg';
import hwField2 from './assets/hardware/hw-field-2.jpg';
import hwDetail from './assets/hardware/hw-detail.jpg';

/** 病害实拍图：病种 code → 主图 / 备图 / 实拍描述 */
export const DISEASE_PHOTOS = {
  rust: {
    main: disRust, alt: wheatClose,
    caption: '小麦叶锈病 · 叶片橙褐色孢子堆（Puccinia spp.）',
    credit: 'Wikimedia Commons · Wheat leaf rust on wheat',
    part: '叶片',
  },
  powdery: {
    main: disPowdery, alt: disPowderyB,
    caption: '小麦白粉病 · 叶片白色粉层（Blumeria graminis）',
    credit: 'Wikimedia Commons · Blumeria graminis',
    part: '叶片',
  },
  loose_smut: {
    main: disLooseSmut, alt: wheatGreen,
    caption: '小麦散黑穗病 · 穗部黑色孢子堆（Tilletia tritici）',
    credit: 'Wikimedia Commons · Tilletia tritici',
    part: '穗部',
  },
  root_rot: {
    main: disRootRot, alt: hwDetail,
    caption: '小麦根腐病 · 茎基褐变（Rhizoctonia solani）',
    credit: 'Wikimedia Commons · Rhizoctonia solani',
    part: '茎基部',
  },
  fusarium: {
    main: disFusarium, alt: wheatClose,
    caption: '小麦赤霉病 · 穗部霉层（Fusarium graminearum）',
    credit: 'Wikimedia Commons · F. graminearum',
    part: '穗部',
  },
  leaf_blight: {
    main: disLeafBlight, alt: fieldWheat2,
    caption: '小麦叶枯病 · 叶片早衰斑（Septoria tritici）',
    credit: 'Wikimedia Commons · Septoria tritici',
    part: '叶片',
  },
};

/** 真实场景照片：用于「现场实景」条带 */
export const SCENE_PHOTOS = [
  { src: fieldSatellite, title: '示范田卫星实景', desc: '200 m × 100 m 作业地块，5 m 网格全覆盖' },
  { src: fieldWheat, title: '冬小麦大田', desc: '抽穗期冠层，高度约 80–110 cm' },
  { src: wheatClose, title: '麦穗近景', desc: 'SAN-GAT-RL 模型的空中识别目标' },
  { src: uavField, title: '植保无人机作业', desc: '自主巡航、识别与喷洒一体化' },
  { src: robotField, title: '地面机器人近距复核', desc: '叶下、根茎、土壤三工位补拍' },
  { src: uavSpray, title: '靶向喷洒', desc: '1 m 窄幅喷头，只对病灶格喷洒' },
  { src: tractorSpray, title: '地面植保对照', desc: '传统整田均匀喷施，浪费显著' },
  { src: fieldResearch, title: '示范田试验区', desc: '不同品种与处理小区对照' },
];

/** 团队自有硬件实物照片 */
export const HARDWARE_PHOTOS = [
  { src: hwUav1, title: '植保无人机', desc: '四旋翼 · 药箱 · 多光谱相机' },
  { src: hwUav2, title: '飞控与载荷', desc: '飞控模块与喷洒控制器' },
  { src: hwUav3, title: '喷头模组', desc: '锥形 / 中圈 / 大圈可切换' },
  { src: hwRobot, title: '地面监测机器人', desc: '四轮底盘 · 云台相机 · 三工位采集臂' },
  { src: hwBoard, title: '边缘计算板', desc: '机载推理，识别结果当场回传' },
  { src: hwField1, title: '现场调试', desc: '农田环境下的链路实测' },
  { src: hwField2, title: '样机联调', desc: '空地协同流程验证' },
];

/** 地块卫星底图 —— 叠在地图上作为实景参照 */
export const SATELLITE_BASEMAP = fieldSatellite;
