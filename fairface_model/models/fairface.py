import torch
import torch.nn as nn
from torchvision import models


class FairFace(nn.Module):
    """FairFace model based on ResNet-34."""

    def __init__(self):
        super().__init__()
        # Load ResNet-34 architecture without pretrained weights
        resnet = models.resnet34(weights=None)

        # Extract ResNet-34 layers for feature extraction
        self.conv1 = resnet.conv1
        self.bn1 = resnet.bn1
        self.relu = resnet.relu
        self.maxpool = resnet.maxpool
        self.layer1 = resnet.layer1
        self.layer2 = resnet.layer2
        self.layer3 = resnet.layer3
        self.layer4 = resnet.layer4
        self.avgpool = resnet.avgpool

        # Custom classification head: 512 features -> 18 outputs (7 race + 2 gender + 9 age)
        self.fc = nn.Linear(512, 18)

    def forward(self, x):
        """Forward pass."""
        # Initial convolution and pooling
        x = self.conv1(x)
        x = self.bn1(x)
        x = self.relu(x)
        x = self.maxpool(x)

        # ResNet blocks
        x = self.layer1(x)
        x = self.layer2(x)
        x = self.layer3(x)
        x = self.layer4(x)

        # Global average pooling and flatten
        x = self.avgpool(x)
        x = torch.flatten(x, 1)

        # Classification head
        x = self.fc(x)

        # Split outputs into race, gender, and age predictions
        race_outputs = x[:, :7]
        gender_outputs = x[:, 7:9]
        age_outputs = x[:, 9:18]

        return race_outputs, gender_outputs, age_outputs
