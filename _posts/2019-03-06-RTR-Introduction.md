---
layout: post
title:  "Realtime rendering reading - 01 Introduction"
date:   2019-03-06 11:55:00
categories: graphics
permalink: /archivers/RTR_01
---

# Introduction

主要是 介绍-概览-符号约定-大致概念解释

# display rate
frames per second(FPS) or Hertz(Hz)是描述图像显示速率的单位。

* 1 FPS 时几乎没有交互性
* 6 FPS 时开始有可交互的感觉了
* 30, 60 或更高的FPS是video games的目标

15ms的延时就会妨碍交互了。
一般头戴式VR设备都要求至少90FPS。

# refresh rate
不同于display rate，refresh_rate = rep_times $\times$ display_rate，用 Hz 表示。

# What is Realtime Rendering

Realtime Rendering一般指快速地产生3D场景的图像，速度要达到可以进行Interaction的程度。

它不仅仅和Interactivity有关，为了达到这种速度，这个过程常常会与图形加速硬件关联。

世界上第一个消费级别的3D图像加速硬件一般认为是 3Dfx Voodoo 1 card (1996)。

而现在不论是台式机或移动设备，基本都具有图形处理器。

这本书主要讲述提升速度和质量的方法，并分析加速算法和图形API的特点和缺点。
内容不会太过深入，而是将主要的概念和术语进行展示，分析当前领域内最为稳定且
被广泛使用的算法。

# Overview

内容十分多，如果看了我会再做标记在这。
* C.2 Graphics Rendering Pipeline
* C.3 Graphics Processing Unit
* C.4 Transforms
* C.5 Shading Basics
* C.6 Texturing
* C.7 Shadows
* C.8 Light and Color
* C.9 Physically Based Shading
* C.10 Local Illumination
* C.11 Global Illumination
* C.12 Image-Space Effects
* C.13 Beyond Polygons
* C.14 Volumetric and Translucency Rendering
* C.15 Non-Photorealistic Rendering
* C.16 Polygonal Techniques
* C.17 Curves and Curved Surfaces
* C.18 Pipeline Optimization
* C.19 Acceleration Algorithms
* C.20 Efficient Shading
* C.21 Virtual and Augmented Reality
* C.22 Intersection Test Methods
* C.23 Graphics Hardware
* C.?? Collision Detection
* The Future

# Notation and Definitions

## mathematical notation
angles角度 和 scalars标量 都是在$\mathbb{R}$中取值的。

Type|Notation|Examples
-|-|-
angle|lowercase Greek|$\alpha_i,\phi,\rho,\eta,\gamma_{242},\theta$
scalar|lowercase italic|$a,b,t,u_k,v,w_{ij}$
vector or point|lowercase bold|$\mathbf{a,u,v_s,h(\rho),h_z}$
matrix|capital bold|$\mathbf{T(t),X,R_x(\rho)}$
plane|$\pi$:a vector and a scalar|$\pi: \mathbf{n \cdot x} + d = 0,$<br>$\pi_1: \mathbf{n_1 \cdot x} + d_1 = 0$
triangle|$\Delta$ 3 Points|$\Delta\mathbf{v_0v_1v_2},\Delta\mathbf{cba}$
line segment|two points|$\mathbf{uv,a_ib_j}$
geometric entity|capital italic|$A_{OBB},T,B_{AABB}$

矩阵有一个特殊的表示，以3x3为例，$M=(m_{,0},m_{,1},m_{,2})=(m_{x},m_{y},m_{z})$，$m_{,j}$为列向量，表示第j列的内容。同样的，$m_{i,}$为列向量，表示第i行的内容。

Index|Operator|Description
-|-|-
1.|$\cdot$|dot product
2.|$\times$|cross product
3.|$\mathbf{v^T}$|transpose of vector v
4.|$^\perp$|unary, perp dot product operator
5.|$\dots$|
6.|$\dots$|
7.|$\|\dots\|$|length or norm of argument
8.|$x^+$|clamping x to 0
9.|$x^\mp$|clamping x between 0 and 1
10.|n!|factorial
11.|$\binom{n}{k}$|binomial coefficients



第4个操作符用于向量。$\mathbf{v}=(v_x,v_y)^T$，则$\mathbf{v^\perp}=(-v_y,v_x)^T$。

<text>第5和第6个操作符为 $\left|\dots\right|$ 。由于markdown列表语法原因打不出来。可以计算方阵的行列式和标量的绝对值。方阵的用法也可以写为$\left|A\right|=\left|\mathbf(a\ b\ c)\right|=det(\mathbf{a,b,c})$</text>

第8个操作符为
$$x^+=\left\{\begin{matrix}x & if\ x>0,\\0 & otherwise\end{matrix}\right.$$

第9个操作符为
$$x^\mp=\left\{\begin{matrix}1 & if\ x\geq 1 ,\\ x & if\ 0<x<1,\\0 & otherwise\end{matrix}\right.$$

第11个操作符为
$$\binom{n}{k}=\frac{n!}{k!(n-k)!}$$


我们将 $x=0,y=0,z=0$的平面称为 coordinate planes 或者 axis-aligned planes。
坐标轴$\mathbf{e}_x=(1\ 0\ 0)^T,\mathbf{e}_y=(0\ 1\ 0)^T,\mathbf{e}_z=(0\ 0\ 1)^T$称为 main axes 或 main directions，也可以分开称为 $x$-axis, $y$-axis, $z$-axis.

C-math的函数 ```atan2(y,x)``` 被经常用到，这是一个arctan(x)的扩展，因为atan接收(y/x)作为参数，导致符号会被抵消，得到结果的范围不是$2\pi$的，而且x不能为0。atan2很好的解决了这两个问题。

$log(n)$在本书一直指$log_e(n)$，而不是$log_{10}(n)$

本书使用的坐标系为右手坐标系，这在CG领域是标准的3D几何系统。

颜色使用RGB构成的向量表示，范围在[0,1]区间。

## Geometrical Definitions

几乎所有图形硬件使用的基本渲染元素(rendering primitives)是 点，线，三角形(points, lines, triangles)。

* 一个model或object指几何元素实体的集合。
* 一个scene是一组包含了环境所有内容的，可渲染的models，scene也可以包含材质(material)描述，光照信息(lighting)以及相机配置。

一个model一般由rendering primitives构成，也可以包含更高层的几何表示，比如Bézier curves(贝塞尔曲线)，Bézier surfaces, 或 subdivision surfaces.

一个model也可以包含其他的model。

## Shading & Shader

Shading: computer-generated visual appearance. 比如 shading model, shading equation, toon shading。

Shader: programmable component of a rendering system. 比如 vertex shader, shading language。

# About book

CG领域变化很快，书上内容说不定什么时候就不够新了。
可以去书的网站查看一些相关信息。
realtimerendering.com
